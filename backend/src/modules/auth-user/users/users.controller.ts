import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { UsersService } from './users.service';

// JwtAuthGuard + RolesGuard được đăng ký toàn cục (APP_GUARD trong AppModule): mọi route ở đây đều
// yêu cầu Bearer JWT hợp lệ (không có @Public), @Roles(...) giới hạn thêm theo vai trò.
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Danh sách tài khoản (ADMIN, STAFF)' })
  @ApiResponse({ status: 200, description: 'Danh sách phân trang' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không đủ quyền' })
  findAll(@Query() filter: UserFilterDto) {
    return this.usersService.findAll(filter);
  }

  @Patch(':id/roles')
  @Roles('ADMIN')
  @ResponseMessage('Đã cập nhật vai trò tài khoản')
  @ApiOperation({ summary: 'Đặt vai trò cho tài khoản (chỉ ADMIN, ghi audit log ROLE_CHANGE)' })
  @ApiResponse({ status: 200, description: 'Vai trò đã được cập nhật (hoặc không đổi)' })
  @ApiResponse({ status: 400, description: 'Vai trò không hợp lệ / tự đổi vai trò của chính mình' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không phải ADMIN' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài khoản' })
  assignRole(
    @CurrentUser('userId') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(actorId, id, dto.role);
  }
}
