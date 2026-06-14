import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationService } from './conversation.service';
import { MockWhatsappProvider } from './providers/mock-whatsapp.provider';
import { InboundMessageDto } from './dto/webhook.dto';
import { Public } from '../../common/decorators/public.decorator';

// Endpoints do canal WhatsApp. Públicos: o webhook é chamado pelo provedor,
// não por um usuário autenticado. O isolamento de tenant vem no payload
// (mock) ou do mapeamento phone_number_id→tenant (Cloud API real).
@Public()
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly conversas: ConversationService,
    private readonly mock: MockWhatsappProvider,
    private readonly config: ConfigService,
  ) {}

  // Verificação do webhook no padrão Meta (handshake inicial).
  @Get('webhook')
  verificar(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const esperado = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === esperado) {
      return challenge;
    }
    throw new ForbiddenException('verify_token inválido');
  }

  // Recebe mensagem (payload já normalizado). Idempotente por messageId.
  @Post('webhook')
  async receber(@Body() dto: InboundMessageDto) {
    return this.conversas.receberMensagem({
      tenantId: dto.tenantId,
      telefoneWa: dto.from,
      texto: dto.text,
      externalId: dto.messageId,
    });
  }

  // ───────── helpers de desenvolvimento (mock) ─────────

  // Simula uma mensagem do MEI gerando o messageId automaticamente.
  @Post('simulate')
  async simular(@Body() body: { tenantId: string; from: string; text: string }) {
    this.assertDev();
    const messageId = `sim-${Date.now()}`;
    const res = await this.conversas.receberMensagem({
      tenantId: body.tenantId,
      telefoneWa: body.from,
      texto: body.text,
      externalId: messageId,
    });
    return { ...res, outbox: this.mock.listarOutbox(body.from) };
  }

  // Inspeciona o que o "WhatsApp" enviou (mock).
  @Get('outbox')
  outbox(@Query('to') to?: string) {
    this.assertDev();
    return this.mock.listarOutbox(to);
  }

  private assertDev() {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Indisponível em produção');
    }
  }
}
