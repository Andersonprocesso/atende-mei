import { UserRole } from '@prisma/client';

// Conteúdo do JWT do painel + objeto injetado em req.user
export interface AuthUser {
  sub: string; // id do usuário
  tenantId: string; // tenant ao qual ele pertence (escopo de todos os dados)
  email: string;
  role: UserRole;
}
