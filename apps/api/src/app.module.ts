import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { FiscalModule } from './modules/fiscal/fiscal.module';
import { SerproModule } from './modules/serpro/serpro.module';
import { BootstrapModule } from './modules/bootstrap/bootstrap.module';
import { AuditModule } from './modules/audit/audit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CryptoModule,
    AuditModule,
    AuthModule,
    HealthModule,
    ClientesModule,
    UsuariosModule,
    WhatsappModule,
    FiscalModule,
    SerproModule,
    BootstrapModule,
    // Próximas etapas: PlanosModule, PagamentosModule, DashboardModule.
  ],
  providers: [
    // JWT global (rotas marcadas com @Public ficam livres), depois papéis.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
