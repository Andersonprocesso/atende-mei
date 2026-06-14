import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanoTier, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

// Em produção o seed via ts-node não roda. Quando SEED_ON_BOOT=true e o banco
// está vazio, cria um tenant demo + admin + planos para haver login inicial.
// Idempotente: não faz nada se já existir algum tenant.
@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.config.get<string>('SEED_ON_BOOT') !== 'true') return;

    const jaTem = await this.prisma.tenant.count();
    if (jaTem > 0) return;

    const email = this.config.get<string>('SEED_ADMIN_EMAIL') ?? 'admin@demo.com';
    const senha = this.config.get<string>('SEED_ADMIN_PASSWORD') ?? 'admin123';

    const tenant = await this.prisma.tenant.create({
      data: { nome: 'Contabilidade Demo' },
    });

    await this.prisma.usuario.create({
      data: {
        tenantId: tenant.id,
        nome: 'Admin',
        email,
        senhaHash: await bcrypt.hash(senha, 10),
        role: UserRole.ADMIN,
      },
    });

    const planos = [
      { tier: PlanoTier.GRATIS, nome: 'Grátis', precoMensal: 0, recursos: { notasPorMes: 3, consultorIA: false } },
      { tier: PlanoTier.MEI_PLUS, nome: 'MEI+', precoMensal: 29.9, recursos: { notasPorMes: 50, consultorIA: true } },
      { tier: PlanoTier.MEI_PLUS_PLUS, nome: 'MEI++', precoMensal: 69.9, recursos: { notasPorMes: -1, consultorIA: true, certificado: true } },
    ];
    for (const p of planos) {
      await this.prisma.plano.create({ data: { tenantId: tenant.id, ...p } });
    }

    this.logger.log(`Bootstrap concluído — login inicial: ${email}`);
  }
}
