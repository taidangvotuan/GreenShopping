import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { RoleName } from '../../../common/decorators/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { AUDIT_ACTION } from '../auth/auth.constants';
import type { UserFilterDto } from './dto/user-filter.dto';

export interface RoleAssignmentResult {
  userId: string;
  previousRoles: string[];
  roles: string[];
  changed: boolean;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Danh sách tài khoản cho ADMIN/STAFF — không trả password_hash. */
  async findAll(filter: UserFilterDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const where = filter.keyword
      ? {
          OR: [
            { email: { contains: filter.keyword } },
            { fullName: { contains: filter.keyword } },
            { phone: { contains: filter.keyword } },
          ],
        }
      : {};

    // SECURITY: Chống SQL Injection bằng parameterized query
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          roles: { select: { role: { select: { name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map(({ id, roles, ...rest }) => ({
        userId: id,
        ...rest,
        roles: roles.map((r) => r.role.name),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * SECURITY (BM-06): luồng cấp quyền DUY NHẤT — chỉ ADMIN gọi được (xem UsersController).
   * Thay toàn bộ vai trò của tài khoản bằng `roleName` và ghi audit log có cấu trúc:
   * actorUserId = actorId, entityId = targetUserId, oldValue/newValue = vai trò cũ/mới, createdAt = timestamp.
   * JwtStrategy đọc roles từ CSDL ở mỗi request → quyền mới/thu hồi có hiệu lực ngay với token đang dùng.
   */
  async assignRole(
    actorId: string,
    targetUserId: string,
    roleName: RoleName,
  ): Promise<RoleAssignmentResult> {
    if (actorId === targetUserId) {
      // Chặn ADMIN tự đổi quyền của mình (tránh tự khóa mất quản trị viên cuối cùng)
      throw new BadRequestException('Không thể tự thay đổi vai trò của chính mình');
    }

    const timestamp = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      // Khóa dòng user đích để hai yêu cầu đổi quyền đồng thời không để lại hai vai trò
      // SECURITY: Chống SQL Injection bằng parameterized query
      const locked = await tx.$queryRaw<{ user_id: string }[]>`
        SELECT user_id FROM \`user\` WHERE user_id = ${targetUserId} FOR UPDATE`;
      if (!locked.length) throw new NotFoundException('Không tìm thấy tài khoản');

      const role = await tx.role.findUnique({ where: { name: roleName }, select: { id: true } });
      if (!role) {
        throw new InternalServerErrorException(`Hệ thống chưa khởi tạo vai trò ${roleName}`);
      }

      const current = await tx.userRole.findMany({
        where: { userId: targetUserId },
        select: { role: { select: { name: true } } },
      });
      const previousRoles = current.map((userRole) => userRole.role.name).sort();
      if (previousRoles.length === 1 && previousRoles[0] === roleName) {
        return { userId: targetUserId, previousRoles, roles: previousRoles, changed: false };
      }

      await tx.userRole.deleteMany({ where: { userId: targetUserId } });
      await tx.userRole.create({ data: { userId: targetUserId, roleId: role.id } });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: AUDIT_ACTION.ROLE_CHANGE,
          entityType: 'User',
          entityId: targetUserId,
          oldValue: { roles: previousRoles },
          newValue: { roles: [roleName] },
          createdAt: timestamp,
        },
      });
      return { userId: targetUserId, previousRoles, roles: [roleName], changed: true };
    });

    if (result.changed) {
      // Log JSON một dòng cho hệ thống thu thập log, song song với bản ghi audit_log trong CSDL
      this.logger.log(
        JSON.stringify({
          event: 'user.role_changed',
          actorId,
          targetUserId,
          oldRole: result.previousRoles.join(',') || null,
          newRole: roleName,
          timestamp: timestamp.toISOString(),
        }),
      );
    }
    return result;
  }
}
