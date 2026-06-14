import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Restringe um handler/controller a certos papéis. Ex.: @Roles('ADMIN')
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
