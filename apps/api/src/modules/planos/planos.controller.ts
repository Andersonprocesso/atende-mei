import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/auth-user';

@Controller('planos')
export class PlanosController {
  constructor(private readonly prisma: PrismaService) {}

  // Lista os planos do tenant (Grátis / MEI+ / MEI++).
  @Get()
  listar(@CurrentUser() user: AuthUser) {
    return this.prisma.plano.findMany({
      where: { tenantId: user.tenantId, ativo: true },
      orderBy: { precoMensal: 'asc' },
      select: { id: true, tier: true, nome: true, precoMensal: true, recursos: true },
    });
  }
}
