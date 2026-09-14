import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Giới hạn route theo vai trò. RolesGuard đọc metadata này. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
