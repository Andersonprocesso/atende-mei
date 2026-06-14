import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  WHATSAPP_PROVIDER,
  WhatsappProvider,
} from '../whatsapp/providers/whatsapp-provider.interface';

export interface ResumoFaturamento {
  ano: number;
  total: number;
  limite: number;
  percentual: number; // 0..100+
  restante: number;
  status: 'OK' | 'ATENCAO' | 'ALERTA' | 'ESTOURADO';
  porMes: { competencia: string; valor: number }[];
}

@Injectable()
export class FaturamentoService {
  private readonly logger = new Logger('Faturamento');
  private readonly limite: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsappProvider,
  ) {
    // Limite anual do MEI (R$ 81.000 desde 2018; configurável).
    this.limite = Number(config.get<string>('LIMITE_MEI_ANUAL') ?? '81000');
  }

  private statusDe(percentual: number): ResumoFaturamento['status'] {
    if (percentual >= 100) return 'ESTOURADO';
    if (percentual >= 90) return 'ALERTA';
    if (percentual >= 80) return 'ATENCAO';
    return 'OK';
  }

  async resumo(tenantId: string, clienteId: string, ano?: number): Promise<ResumoFaturamento> {
    const anoRef = ano ?? new Date().getFullYear();
    const lancs = await this.prisma.lancamentoFaturamento.findMany({
      where: { tenantId, clienteId, ano: anoRef },
      orderBy: { competencia: 'asc' },
    });
    const total = lancs.reduce((s, l) => s + Number(l.valor), 0);
    const percentual = this.limite > 0 ? (total / this.limite) * 100 : 0;

    const porMesMap = new Map<string, number>();
    for (const l of lancs) {
      porMesMap.set(l.competencia, (porMesMap.get(l.competencia) ?? 0) + Number(l.valor));
    }

    return {
      ano: anoRef,
      total,
      limite: this.limite,
      percentual: Math.round(percentual * 10) / 10,
      restante: Math.max(this.limite - total, 0),
      status: this.statusDe(percentual),
      porMes: [...porMesMap.entries()].map(([competencia, valor]) => ({ competencia, valor })),
    };
  }

  async adicionar(
    tenantId: string,
    usuarioId: string | null,
    clienteId: string,
    dto: { competencia: string; valor: number; descricao?: string; origem?: string; notaFiscalId?: string },
  ) {
    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, tenantId } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');

    const ano = parseInt(dto.competencia.slice(0, 4), 10);
    const lanc = await this.prisma.lancamentoFaturamento.create({
      data: {
        tenantId,
        clienteId,
        competencia: dto.competencia,
        ano,
        valor: dto.valor,
        descricao: dto.descricao,
        origem: dto.origem ?? 'MANUAL',
        notaFiscalId: dto.notaFiscalId,
      },
    });
    await this.audit.log({
      tenantId,
      usuarioId,
      acao: 'faturamento.lancar',
      entidade: 'LancamentoFaturamento',
      entidadeId: lanc.id,
      dados: { competencia: dto.competencia, valor: dto.valor },
    });

    // checa limite e avisa o MEI no WhatsApp se cruzou um patamar
    await this.verificarLimite(tenantId, clienteId, ano).catch((e) =>
      this.logger.error(`verificarLimite: ${e}`),
    );
    return lanc;
  }

  async listar(tenantId: string, clienteId: string, ano?: number) {
    const anoRef = ano ?? new Date().getFullYear();
    return this.prisma.lancamentoFaturamento.findMany({
      where: { tenantId, clienteId, ano: anoRef },
      orderBy: { competencia: 'desc' },
    });
  }

  // Carteira: clientes mais próximos do limite no ano corrente.
  async alertasCarteira(tenantId: string) {
    const ano = new Date().getFullYear();
    const grupos = await this.prisma.lancamentoFaturamento.groupBy({
      by: ['clienteId'],
      where: { tenantId, ano },
      _sum: { valor: true },
    });
    const ordenados = grupos
      .map((g) => {
        const total = Number(g._sum.valor ?? 0);
        const percentual = this.limite > 0 ? (total / this.limite) * 100 : 0;
        return { clienteId: g.clienteId, total, percentual: Math.round(percentual * 10) / 10, status: this.statusDe(percentual) };
      })
      .filter((x) => x.percentual >= 80)
      .sort((a, b) => b.percentual - a.percentual);

    const ids = ordenados.map((o) => o.clienteId);
    const clientes = await this.prisma.cliente.findMany({
      where: { id: { in: ids } },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
    });
    const byId = new Map(clientes.map((c) => [c.id, c]));
    return ordenados.map((o) => ({ ...o, cliente: byId.get(o.clienteId) ?? null }));
  }

  // Envia aviso ao MEI quando ultrapassa 80% / 100% (uma vez por patamar/ano).
  private async verificarLimite(tenantId: string, clienteId: string, ano: number) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente?.telefoneWa) return;

    const { total, percentual, restante } = await this.resumo(tenantId, clienteId, ano);
    let patamar: number | null = null;
    if (percentual >= 100) patamar = 100;
    else if (percentual >= 80) patamar = 80;
    if (!patamar) return;

    const marca = `${ano}:${patamar}`;
    if (cliente.limiteAlertaEnviado === marca) return; // já avisou nesse patamar

    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const msg =
      patamar >= 100
        ? `🚨 *Atenção!* Seu faturamento de ${ano} como MEI atingiu *R$ ${fmt(total)}* — você *ultrapassou o limite* de R$ ${fmt(this.limite)}. Vamos te orientar sobre o desenquadramento e os próximos passos. Fale com a contabilidade.`
        : `⚠️ *Aviso de limite MEI*: seu faturamento de ${ano} já está em *R$ ${fmt(total)}* (${percentual}% do limite de R$ ${fmt(this.limite)}). Restam cerca de *R$ ${fmt(restante)}*. Fique de olho para não ultrapassar! 😉`;

    try {
      await this.whatsapp.enviarTexto(cliente.telefoneWa, msg);
      await this.prisma.cliente.update({
        where: { id: clienteId },
        data: { limiteAlertaEnviado: marca },
      });
      this.logger.log(`Alerta de limite (${patamar}%) enviado ao cliente ${clienteId}`);
    } catch (e) {
      this.logger.error(`Falha ao enviar alerta de limite: ${e}`);
    }
  }
}
