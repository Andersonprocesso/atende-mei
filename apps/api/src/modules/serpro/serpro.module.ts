import { Module } from '@nestjs/common';
import { SerproAuthService } from './serpro-auth.service';
import { SerproClient } from './serpro.client';
import { PgmeiService } from './pgmei.service';
import { CredenciaisSerproService } from './credenciais-serpro.service';
import { SerproController } from './serpro.controller';
import { AuditModule } from '../audit/audit.module';

// Integração SERPRO (Integra Contador) — DAS-MEI via PGMEI.
// Credenciais por tenant, cifradas, subidas pelo painel (ou via env como fallback).
@Module({
  imports: [AuditModule],
  controllers: [SerproController],
  providers: [
    SerproAuthService,
    SerproClient,
    PgmeiService,
    CredenciaisSerproService,
  ],
  exports: [PgmeiService, SerproClient],
})
export class SerproModule {}
