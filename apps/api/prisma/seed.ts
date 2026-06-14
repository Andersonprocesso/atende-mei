import { PrismaClient, UserRole, PlanoTier } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Tenant demo (uma contabilidade)
  const tenant = await prisma.tenant.upsert({
    where: { cnpj: '12345678000199' },
    update: {},
    create: {
      nome: 'Contabilidade Demo',
      cnpj: '12345678000199',
      email: 'contato@contabilidadedemo.com.br',
    },
  });

  // Usuário admin do painel
  const senhaHash = await bcrypt.hash('admin123', 10);
  await prisma.usuario.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      nome: 'Admin Demo',
      email: 'admin@demo.com',
      senhaHash,
      role: UserRole.ADMIN,
    },
  });

  // Planos (Grátis, MEI+, MEI++)
  const planos: { tier: PlanoTier; nome: string; precoMensal: number; recursos: any }[] = [
    { tier: PlanoTier.GRATIS, nome: 'Grátis', precoMensal: 0, recursos: { notasPorMes: 3, consultorIA: false } },
    { tier: PlanoTier.MEI_PLUS, nome: 'MEI+', precoMensal: 29.9, recursos: { notasPorMes: 50, consultorIA: true } },
    { tier: PlanoTier.MEI_PLUS_PLUS, nome: 'MEI++', precoMensal: 69.9, recursos: { notasPorMes: -1, consultorIA: true, certificado: true } },
  ];
  for (const p of planos) {
    await prisma.plano.upsert({
      where: { tenantId_tier: { tenantId: tenant.id, tier: p.tier } },
      update: { precoMensal: p.precoMensal, nome: p.nome, recursos: p.recursos },
      create: { tenantId: tenant.id, ...p },
    });
  }

  // Cliente MEI de exemplo
  await prisma.cliente.upsert({
    where: { tenantId_cnpj: { tenantId: tenant.id, cnpj: '98765432000111' } },
    update: {},
    create: {
      tenantId: tenant.id,
      cnpj: '98765432000111',
      razaoSocial: 'João da Silva 98765432000111',
      nomeFantasia: 'Salgados do João',
      nomeContato: 'João da Silva',
      telefoneWa: '+5511999999999',
      email: 'joao@exemplo.com',
    },
  });

  console.log('Seed concluído. Login do painel: admin@demo.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
