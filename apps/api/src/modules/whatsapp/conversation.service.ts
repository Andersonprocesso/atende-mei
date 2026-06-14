import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConversaStatus,
  DirecaoMensagem,
  Prisma,
  RemetenteTipo,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConversationStateMachine } from './conversation-state-machine';
import {
  WHATSAPP_PROVIDER,
  WhatsappProvider,
} from './providers/whatsapp-provider.interface';

export interface MensagemRecebida {
  tenantId: string;
  telefoneWa: string; // E.164
  texto: string;
  externalId: string; // id da mensagem no provedor (idempotência)
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sm: ConversationStateMachine,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsappProvider,
  ) {}

  async receberMensagem(msg: MensagemRecebida) {
    // 1. Idempotência: webhook pode reentregar o mesmo evento.
    const jaProcessada = await this.prisma.mensagem.findUnique({
      where: {
        tenantId_externalId: {
          tenantId: msg.tenantId,
          externalId: msg.externalId,
        },
      },
    });
    if (jaProcessada) {
      this.logger.debug(`Mensagem ${msg.externalId} já processada — ignorando`);
      return { status: 'duplicada' as const };
    }

    // 2. Cliente (cria "lead" se for um número novo — onboarding cuida do CNPJ).
    const cliente = await this.acharOuCriarCliente(msg.tenantId, msg.telefoneWa);

    // 3. Conversa aberta do cliente (ou cria uma).
    const conversa = await this.acharOuCriarConversa(msg.tenantId, cliente.id);

    // 4. Persiste a mensagem de entrada.
    await this.prisma.mensagem.create({
      data: {
        tenantId: msg.tenantId,
        conversaId: conversa.id,
        direcao: DirecaoMensagem.ENTRADA,
        remetente: RemetenteTipo.CLIENTE,
        externalId: msg.externalId,
        conteudo: msg.texto,
      },
    });
    await this.prisma.conversa.update({
      where: { id: conversa.id },
      data: { ultimaMsgEm: new Date() },
    });

    // 5. Em handoff humano, o bot fica em silêncio: o atendente responde pela inbox.
    if (conversa.status === ConversaStatus.HUMANO) {
      return { status: 'em-atendimento-humano' as const };
    }

    // 6. Roda a máquina de estados.
    const contexto = (conversa.contexto as Record<string, unknown>) ?? {};
    const resultado = await this.sm.processar({
      texto: msg.texto,
      estado: conversa.estado,
      contexto,
      cliente: {
        id: cliente.id,
        cnpj: cliente.cnpj,
        nomeContato: cliente.nomeContato,
      },
    });

    // 7. Atualiza cadastro do cliente (onboarding).
    if (resultado.atualizarCliente?.cnpj) {
      await this.prisma.cliente.update({
        where: { id: cliente.id },
        data: { cnpj: resultado.atualizarCliente.cnpj },
      });
    }

    // 8. Envia e persiste as respostas do bot.
    for (const texto of resultado.respostas) {
      const enviada = await this.whatsapp.enviarTexto(msg.telefoneWa, texto);
      await this.prisma.mensagem.create({
        data: {
          tenantId: msg.tenantId,
          conversaId: conversa.id,
          direcao: DirecaoMensagem.SAIDA,
          remetente: RemetenteTipo.BOT,
          externalId: enviada.externalId,
          conteudo: texto,
        },
      });
    }

    // 9. Atualiza estado/contexto/status da conversa.
    await this.prisma.conversa.update({
      where: { id: conversa.id },
      data: {
        estado: resultado.novoEstado,
        contexto: resultado.novoContexto as Prisma.InputJsonValue,
        status: resultado.handoff ? ConversaStatus.HUMANO : conversa.status,
        ultimaMsgEm: new Date(),
      },
    });

    // 10. Ação de negócio disparada (emissão real fica para a etapa 4).
    if (resultado.acaoPendente) {
      await this.audit.log({
        tenantId: msg.tenantId,
        acao: `conversa.acao.${resultado.acaoPendente.tipo}`,
        entidade: 'Conversa',
        entidadeId: conversa.id,
        dados: resultado.acaoPendente.dados as Prisma.InputJsonValue,
      });
      this.logger.log(
        `Ação pendente ${resultado.acaoPendente.tipo} (conversa ${conversa.id}) — implementar na etapa 4`,
      );
    }

    return {
      status: 'respondida' as const,
      handoff: !!resultado.handoff,
      respostas: resultado.respostas,
    };
  }

  private async acharOuCriarCliente(tenantId: string, telefoneWa: string) {
    const existente = await this.prisma.cliente.findUnique({
      where: { tenantId_telefoneWa: { tenantId, telefoneWa } },
    });
    if (existente) return existente;

    const novo = await this.prisma.cliente.create({
      data: { tenantId, telefoneWa },
    });
    await this.audit.log({
      tenantId,
      acao: 'cliente.criar.whatsapp',
      entidade: 'Cliente',
      entidadeId: novo.id,
    });
    return novo;
  }

  private async acharOuCriarConversa(tenantId: string, clienteId: string) {
    const aberta = await this.prisma.conversa.findFirst({
      where: {
        tenantId,
        clienteId,
        status: { not: ConversaStatus.ENCERRADA },
      },
      orderBy: { criadoEm: 'desc' },
    });
    if (aberta) return aberta;

    return this.prisma.conversa.create({
      data: { tenantId, clienteId, status: ConversaStatus.BOT },
    });
  }
}
