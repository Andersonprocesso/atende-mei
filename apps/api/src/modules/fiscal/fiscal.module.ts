import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FISCAL_PROVIDER } from './fiscal-provider.interface';
import { FakeFiscalProvider } from './fake-fiscal.provider';
import { OmieFiscalProvider } from './omie/omie-fiscal.provider';
import { OmieClient } from './omie/omie.client';
import { FiscalController } from './fiscal.controller';

// Seleciona o adapter fiscal conforme FISCAL_PROVIDER (fake | omie).
@Module({
  controllers: [FiscalController],
  providers: [
    OmieClient,
    FakeFiscalProvider,
    OmieFiscalProvider,
    {
      provide: FISCAL_PROVIDER,
      inject: [ConfigService, FakeFiscalProvider, OmieFiscalProvider],
      useFactory: (
        config: ConfigService,
        fake: FakeFiscalProvider,
        omie: OmieFiscalProvider,
      ) => {
        const provider = config.get<string>('FISCAL_PROVIDER') ?? 'fake';
        switch (provider) {
          case 'omie':
            return omie;
          case 'fake':
            return fake;
          default:
            throw new Error(`FISCAL_PROVIDER="${provider}" não implementado`);
        }
      },
    },
  ],
  exports: [FISCAL_PROVIDER, OmieClient],
})
export class FiscalModule {}
