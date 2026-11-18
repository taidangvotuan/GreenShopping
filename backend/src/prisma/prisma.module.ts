import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global: chỉ cần import PrismaModule một lần trong AppModule,
 * mọi module nghiệp vụ đều inject được PrismaService.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
