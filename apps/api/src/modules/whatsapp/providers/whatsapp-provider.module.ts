import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WHATSAPP_PROVIDER } from './whatsapp-provider.interface';
import { MockWhatsappProvider } from './mock-whatsapp.provider';

// Seleciona o adapter de WhatsApp conforme WHATSAPP_PROVIDER.
// "cloud-api" (Meta) deve implementar WhatsappProvider e ser plugado aqui.
@Module({
  providers: [
    MockWhatsappProvider,
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ConfigService, MockWhatsappProvider],
      useFactory: (config: ConfigService, mock: MockWhatsappProvider) => {
        const provider = config.get<string>('WHATSAPP_PROVIDER') ?? 'mock';
        switch (provider) {
          case 'mock':
            return mock;
          default:
            throw new Error(
              `WHATSAPP_PROVIDER="${provider}" ainda não implementado. ` +
                `Implemente um WhatsappProvider e registre-o aqui.`,
            );
        }
      },
    },
  ],
  // exporta também o mock concreto para o controller de inspeção da outbox (dev)
  exports: [WHATSAPP_PROVIDER, MockWhatsappProvider],
})
export class WhatsappProviderModule {}
