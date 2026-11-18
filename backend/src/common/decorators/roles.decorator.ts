import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Tên role khớp cột role.name (seed sẵn). */
export const ROLE_NAMES = ['CUSTOMER', 'SELLER', 'STAFF', 'ADMIN'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

/** Chỉ cho phép user có ÍT NHẤT MỘT trong các role được liệt kê. */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
