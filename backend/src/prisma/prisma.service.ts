import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

/**
 * PrismaService — một Prisma Client dùng chung cho toàn bộ module.
 * Prisma 7 bắt buộc truyền driver adapter; với MySQL dùng @prisma/adapter-mariadb.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const url = new URL(config.getOrThrow<string>('DATABASE_URL'));

    const adapter = new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      connectionLimit: 10,
      // MySQL 8.4 dùng caching_sha2_password; khi chạy local không SSL
      // driver cần lấy public key của server để xác thực.
      allowPublicKeyRetrieval: true,
    });

    super({
      adapter,
      log:
        config.get('NODE_ENV') === 'development'
          ? ['warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
