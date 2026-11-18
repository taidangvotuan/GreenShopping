import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY, type RoleName } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Guard toàn cục chạy SAU JwtAuthGuard: đọc metadata @Roles(...).
 * Không gắn @Roles → chỉ cần đăng nhập. Có @Roles → user phải có ít nhất 1 role khớp.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const required = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, targets);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const allowed = user?.roles?.some((r) => required.includes(r as RoleName));
    if (!allowed) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng này');
    }
    return true;
  }
}
