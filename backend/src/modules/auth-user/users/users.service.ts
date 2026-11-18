import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { UserFilterDto } from './dto/user-filter.dto';

@Injectable()
export class UsersService {
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
}
