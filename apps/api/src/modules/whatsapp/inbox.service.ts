import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversaStatus,
  DirecaoMensagem,
  RemetenteTipo,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WHATSAPP_PROVIDER,
  WhatsappProvider,
} from './providers/whatsapp-provider.interface';

// Operações da inbox unificada usadas pelo painel do contador.
@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsappProvider,
  ) {}

  listarConversas(tenantId: string, status?: ConversaStatus) {
    return this.prisma.conversa.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { ultimaMsgEm: 'desc' },
      include: {
        cliente: {
          select: { id: true, nomeFantasia: true, nomeContato: true, telefoneWa: true },
        },
        atendente: { select: { id: true, nome: true } },
        mensagens: { orderBy: { criadoEm: 'desc' }, take: 1 },
      },
    });
  }

  async mensagens(tenantId: string, conversaId: string) {
    await this.ensureConversa(tenantId, conversaId);
    return this.prisma.mensagem.findMany({
      where: { tenantId, conversaId },
      orderBy: { criadoEm: 'asc' },
    });
  }

  // Atendente assume a conversa (handoff): bot silencia.
  async assumir(tenantId: string, conversaId: string, atendenteId: string) {
    await this.ensureConversa(tenantId, conversaId);
    return this.prisma.conversa.update({
      where: { id: conversaId },
      data: { status: ConversaStatus.HUMANO, atendenteId },
    });
  }

  // Devolve a conversa ao bot.
  async devolver(tenantId: string, conversaId: string) {
    await this.ensureConversa(tenantId, conversaId);
    return this.prisma.conversa.update({
      where: { id: conversaId },
      data: { status: ConversaStatus.BOT, atendenteId: null, estado: null },
    });
  }

  // Atendente responde manualmente pelo painel.
  async responder(
    tenantId: string,
    conversaId: string,
    atendenteId: string,
    texto: string,
  ) {
    const conversa = await this.ensureConversa(tenantId, conversaId);
    if (!conversa.cliente.telefoneWa) {
      throw new BadRequestException('Cliente sem número de WhatsApp vinculado');
    }

    const enviada = await this.whatsapp.enviarTexto(
      conversa.cliente.telefoneWa,
      texto,
    );
    const msg = await this.prisma.mensagem.create({
      data: {
        tenantId,
        conversaId,
        direcao: DirecaoMensagem.SAIDA,
        remetente: RemetenteTipo.ATENDENTE,
        externalId: enviada.externalId,
        conteudo: texto,
      },
    });
    await this.prisma.conversa.update({
      where: { id: conversaId },
      data: {
        ultimaMsgEm: new Date(),
        // se ainda não estava em handoff, marca que um humano respondeu
        status: ConversaStatus.HUMANO,
        atendenteId,
      },
    });
    return msg;
  }

  private async ensureConversa(tenantId: string, conversaId: string) {
    const c = await this.prisma.conversa.findFirst({
      where: { id: conversaId, tenantId },
      include: { cliente: { select: { telefoneWa: true } } },
    });
    if (!c) throw new NotFoundException('Conversa não encontrada');
    return c;
  }
}
