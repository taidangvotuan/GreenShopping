import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../../src/modules/auth-user/users/users.service';
import type { PrismaService } from '../../src/prisma/prisma.service';

const ADMIN_ID = '0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const TARGET_ID = '7d4f6f0e-2a59-4a8e-9a43-0b6f3f6b1c11';

function setup(currentRoles: string[] = ['CUSTOMER']) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ user_id: TARGET_ID }]),
    role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-seller' }) },
    userRole: {
      findMany: jest.fn().mockResolvedValue(currentRoles.map((name) => ({ role: { name } }))),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const service = new UsersService(prisma as unknown as PrismaService);
  return { service, prisma, tx };
}

describe('UsersService.assignRole — cấp quyền có kiểm soát (BM-06)', () => {
  it('đổi CUSTOMER → SELLER trong transaction có khóa dòng, ghi audit log + log JSON có cấu trúc', async () => {
    const { service, tx } = setup(['CUSTOMER']);
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const result = await service.assignRole(ADMIN_ID, TARGET_ID, 'SELLER');

    expect(result).toEqual({
      userId: TARGET_ID,
      previousRoles: ['CUSTOMER'],
      roles: ['SELLER'],
      changed: true,
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1); // SELECT ... FOR UPDATE trên user đích
    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET_ID } });
    expect(tx.userRole.create).toHaveBeenCalledWith({
      data: { userId: TARGET_ID, roleId: 'role-seller' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: ADMIN_ID,
        action: 'ROLE_CHANGE',
        entityType: 'User',
        entityId: TARGET_ID,
        oldValue: { roles: ['CUSTOMER'] },
        newValue: { roles: ['SELLER'] },
        createdAt: expect.any(Date),
      },
    });

    const entry = JSON.parse(log.mock.calls[0][0] as string);
    expect(entry).toEqual({
      event: 'user.role_changed',
      actorId: ADMIN_ID,
      targetUserId: TARGET_ID,
      oldRole: 'CUSTOMER',
      newRole: 'SELLER',
      timestamp: expect.any(String),
    });
    log.mockRestore();
  });

  it('vai trò không đổi → không ghi gì, changed=false', async () => {
    const { service, tx } = setup(['SELLER']);

    await expect(service.assignRole(ADMIN_ID, TARGET_ID, 'SELLER')).resolves.toMatchObject({
      changed: false,
      roles: ['SELLER'],
    });
    expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('ADMIN tự đổi vai trò của chính mình → 400, không mở transaction', async () => {
    const { service, prisma } = setup();

    await expect(service.assignRole(ADMIN_ID, ADMIN_ID, 'CUSTOMER')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('tài khoản đích không tồn tại → 404', async () => {
    const { service, tx } = setup();
    tx.$queryRaw.mockResolvedValue([]);

    await expect(service.assignRole(ADMIN_ID, TARGET_ID, 'STAFF')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('role chưa được seed → 500, không xóa vai trò hiện có', async () => {
    const { service, tx } = setup();
    tx.role.findUnique.mockResolvedValue(null);

    await expect(service.assignRole(ADMIN_ID, TARGET_ID, 'STAFF')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
  });
});
