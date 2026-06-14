import { Module } from '@nestjs/common';
import { FaturamentoService } from './faturamento.service';
import { FaturamentoController } from './faturamento.controller';
import { AuditModule } from '../audit/audit.module';
import { WhatsappProviderModule } from '../whatsapp/providers/whatsapp-provider.module';

@Module({
  imports: [AuditModule, WhatsappProviderModule],
  controllers: [FaturamentoController],
  providers: [FaturamentoService],
  exports: [FaturamentoService],
})
export class FaturamentoModule {}
