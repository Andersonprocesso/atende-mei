import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CadastrarClienteInput,
  CadastrarClienteResult,
  EmitirNFSeInput,
  EmitirNFSeResult,
  FiscalProvider,
} from '../fiscal-provider.interface';
import { OmieApiError, OmieClient } from './omie.client';

// Adapter fiscal real via API Omie.
// CADASTRO de cliente: implementado e seguro (consulta/inclui).
// EMISSÃO de NFS-e: monta a Ordem de Serviço e fatura — porém depende de
// configuração fiscal da conta (código de serviço LC116, categoria, conta
// corrente, integração da prefeitura). Sem esses dados o método retorna ERRO
// com mensagem clara, sem gerar documento inválido.
@Injectable()
export class OmieFiscalProvider implements FiscalProvider {
  private readonly logger = new Logger('OmieFiscal');

  // códigos específicos da conta — preenchidos via env quando o fiscal estiver pronto
  private readonly codServico: string;
  private readonly codCategoria: string;
  private readonly codContaCorrente: string;
  private readonly aliquotaIss: number;
  private readonly autoFaturar: boolean;

  constructor(
    private readonly omie: OmieClient,
    config: ConfigService,
  ) {
    this.codServico = config.get<string>('OMIE_COD_SERVICO') ?? '';
    this.codCategoria = config.get<string>('OMIE_COD_CATEGORIA') ?? '';
    this.codContaCorrente = config.get<string>('OMIE_COD_CONTA_CORRENTE') ?? '';
    this.aliquotaIss = Number(config.get<string>('OMIE_ALIQUOTA_ISS') ?? '0');
    this.autoFaturar = config.get<string>('OMIE_AUTO_FATURAR') === 'true';
  }

  nome() {
    return 'omie';
  }

  async cadastrarCliente(
    input: CadastrarClienteInput,
  ): Promise<CadastrarClienteResult> {
    // 1) tenta localizar por CNPJ (idempotência)
    const existente = await this.consultarPorCnpj(input.cnpj);
    if (existente) {
      return { codigoProvider: String(existente), jaExistia: true };
    }

    // 2) inclui novo cliente
    const cnpjFmt = this.formatarCnpj(input.cnpj);
    const resp = await this.omie.call('geral/clientes', 'IncluirCliente', {
      codigo_cliente_integracao: `atendemei-${input.cnpj}`,
      razao_social: input.razaoSocial ?? input.nomeFantasia ?? cnpjFmt,
      nome_fantasia: input.nomeFantasia ?? undefined,
      cnpj_cpf: cnpjFmt,
      email: input.email ?? undefined,
      telefone1_numero: input.telefone ?? undefined,
      tags: [{ tag: 'MEI' }, { tag: 'AtendeMEI' }],
    });
    return { codigoProvider: String(resp.codigo_cliente_omie), jaExistia: false };
  }

  async emitirNFSe(input: EmitirNFSeInput): Promise<EmitirNFSeResult> {
    // pré-condição: configuração fiscal da conta
    if (!this.codServico || !this.codCategoria || !this.codContaCorrente) {
      return {
        status: 'ERRO',
        erro:
          'Emissão indisponível: configure OMIE_COD_SERVICO, OMIE_COD_CATEGORIA ' +
          'e OMIE_COD_CONTA_CORRENTE (cadastro de serviço + integração da prefeitura na Omie).',
      };
    }

    try {
      const codCli =
        input.codigoClienteProvider ??
        (await this.cadastrarCliente(input.cliente)).codigoProvider;

      // cria a Ordem de Serviço (rascunho — NÃO é o documento fiscal ainda)
      const os = await this.omie.call('servicos/os', 'IncluirOS', {
        Cabecalho: {
          cCodIntOS: `atendemei-${Date.now()}`,
          cCodCli: Number(codCli),
          cEtapa: '10',
          nCodCC: Number(this.codContaCorrente),
        },
        ServicosPrestados: [
          {
            cDescServ: input.descricao,
            nQtde: 1,
            nValUnit: input.valor,
            cCodServ: this.codServico,
            nAliqISS: this.aliquotaIss,
          },
        ],
        InformacoesAdicionais: {
          cCodCateg: this.codCategoria,
          nCodCC: Number(this.codContaCorrente),
        },
      });

      const codigoOs = String(os.nCodOS ?? os.cCodIntOS ?? '');

      // a emissão fiscal (faturamento) só ocorre quando autorizada
      if (!this.autoFaturar) {
        return {
          status: 'PENDENTE',
          providerRef: codigoOs,
          erro: 'OS criada na Omie. Faturamento (emissão da NFS-e) aguardando autorização (OMIE_AUTO_FATURAR).',
        };
      }

      const fat = await this.omie.call('servicos/os', 'FaturarOS', {
        nCodOS: Number(codigoOs),
      });
      return {
        status: 'EMITIDA',
        providerRef: codigoOs,
        numero: String(fat.cNumNFSe ?? ''),
        pdfUrl: fat.cLinkNFSe ?? undefined,
      };
    } catch (e) {
      const msg = e instanceof OmieApiError ? e.message : 'Falha na emissão Omie';
      this.logger.error(`emitirNFSe: ${msg}`);
      return { status: 'ERRO', erro: msg };
    }
  }

  // ───────── helpers ─────────

  // retorna codigo_cliente_omie se existir, senão null
  private async consultarPorCnpj(cnpj: string): Promise<number | null> {
    try {
      const resp = await this.omie.call('geral/clientes', 'ConsultarCliente', {
        cnpj_cpf: this.formatarCnpj(cnpj),
      });
      return resp?.codigo_cliente_omie ?? null;
    } catch (e) {
      // "cliente não encontrado" é esperado — devolve null
      if (e instanceof OmieApiError) return null;
      throw e;
    }
  }

  private formatarCnpj(cnpj: string): string {
    const d = cnpj.replace(/\D/g, '');
    if (d.length !== 14) return cnpj;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
}
