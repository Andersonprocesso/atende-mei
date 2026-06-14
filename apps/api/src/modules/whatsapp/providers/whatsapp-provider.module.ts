import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WHATSAPP_PROVIDER } from './whatsapp-provider.interface';
import { MockWhatsappProvider } from './mock-whatsapp.provider';
import { BaileysWhatsappProvider } from './baileys-whatsapp.provider';

// Seleciona o adapter de WhatsApp conforme WHATSAPP_PROVIDER (mock | baileys).
@Module({
  providers: [
    MockWhatsappProvider,
    BaileysWhatsappProvider,
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ConfigService, MockWhatsappProvider, BaileysWhatsappProvider],
      useFactory: (
        config: ConfigService,
        mock: MockWhatsappProvider,
        baileys: BaileysWhatsappProvider,
      ) => {
        const provider = config.get<string>('WHATSAPP_PROVIDER') ?? 'mock';
        switch (provider) {
          case 'baileys':
            return baileys;
          case 'mock':
            return mock;
          default:
            throw new Error(
              `WHATSAPP_PROVIDER="${provider}" não implementado. Use mock | baileys.`,
            );
        }
      },
    },
  ],
  exports: [WHATSAPP_PROVIDER, MockWhatsappProvider, BaileysWhatsappProvider],
})
export class WhatsappProviderModule {}
