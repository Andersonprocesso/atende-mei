import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationService } from './conversation.service';
import { BaileysWhatsappProvider } from './providers/baileys-whatsapp.provider';

// Liga o Baileys ao fluxo: registra o handler de mensagens recebidas
// (→ ConversationService) e inicia a conexão do tenant. Só age quando
// WHATSAPP_PROVIDER=baileys.
@Injectable()
export class BaileysIngestService implements OnModuleInit {
  private readonly logger = new Logger('BaileysIngest');

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly conversas: ConversationService,
    private readonly baileys: BaileysWhatsappProvider,
  ) {}

  async onModuleInit() {
    if ((this.config.get<string>('WHATSAPP_PROVIDER') ?? 'mock') !== 'baileys') return;

    const tenantId = await this.resolverTenant();
    if (!tenantId) {
      this.logger.warn('Nenhum tenant para conectar o WhatsApp.');
      return;
    }

    this.baileys.registrarHandler(async (msg) => {
      await this.conversas.receberMensagem(msg);
    });

    this.logger.log(`Iniciando Baileys para o tenant ${tenantId}…`);
    await this.baileys.iniciar(tenantId);
  }

  private async resolverTenant(): Promise<string | null> {
    const env = this.config.get<string>('WHATSAPP_TENANT_ID');
    if (env) return env;
    const t = await this.prisma.tenant.findFirst({ orderBy: { criadoEm: 'asc' } });
    return t?.id ?? null;
  }
}
