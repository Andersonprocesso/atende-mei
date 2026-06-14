import { Module } from '@nestjs/common';
import { NfeBuscaService } from './nfe-busca.service';
import { NfeController } from './nfe.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [NfeController],
  providers: [NfeBuscaService],
})
export class NfeModule {}
