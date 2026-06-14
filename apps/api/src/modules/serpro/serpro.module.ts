import { Module } from '@nestjs/common';
import { SerproAuthService } from './serpro-auth.service';
import { SerproClient } from './serpro.client';
import { PgmeiService } from './pgmei.service';
import { SerproController } from './serpro.controller';
import { AuditModule } from '../audit/audit.module';

// Integração SERPRO (Integra Contador) — DAS-MEI via PGMEI.
// Credenciais da Dias de Paula via env (inerte enquanto não configuradas).
@Module({
  imports: [AuditModule],
  controllers: [SerproController],
  providers: [SerproAuthService, SerproClient, PgmeiService],
  exports: [PgmeiService, SerproClient],
})
export class SerproModule {}
