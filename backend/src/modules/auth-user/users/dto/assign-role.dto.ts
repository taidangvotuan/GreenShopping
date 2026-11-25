import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString } from 'class-validator';
import { ROLE_NAMES, type RoleName } from '../../../../common/decorators/roles.decorator';

/** PATCH /users/:id/roles — ADMIN đặt vai trò (thay thế toàn bộ vai trò hiện có) cho một tài khoản. */
export class AssignRoleDto {
  @ApiProperty({ enum: ROLE_NAMES, example: 'SELLER' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'Vai trò phải là chuỗi' })
  @IsIn(ROLE_NAMES, { message: 'Vai trò không hợp lệ' })
  role: RoleName;
}
