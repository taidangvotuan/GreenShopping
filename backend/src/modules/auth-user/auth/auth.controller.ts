import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { AuthService, type RequestMeta } from './auth.service';
import { AuthUserDto, LoginResponseDto, LogoutResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Đăng ký tài khoản thành công')
  @ApiOperation({ summary: 'Đăng ký tài khoản (role thuộc whitelist CUSTOMER | SELLER | STAFF | ADMIN)' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Tạo tài khoản thành công', type: AuthUserDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Email hoặc số điện thoại đã được sử dụng' })
  @ApiResponse({ status: 429, description: 'Gửi quá nhiều yêu cầu' })
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<AuthUserDto> {
    return this.authService.register(dto, this.meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Đăng nhập thành công')
  @ApiOperation({ summary: 'Đăng nhập bằng Email hoặc Số điện thoại' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Tên đăng nhập hoặc mật khẩu không đúng' })
  @ApiResponse({ status: 403, description: 'Tài khoản bị khóa / ngừng hoạt động / chờ kích hoạt' })
  @ApiResponse({ status: 429, description: 'Gửi quá nhiều yêu cầu' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    return this.authService.login(dto, this.meta(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Đăng xuất thành công')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất (ghi nhật ký; client tự xóa token)' })
  @ApiResponse({ status: 200, type: LogoutResponseDto })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc token hết hạn' })
  logout(
    @CurrentUser('userId') userId: string,
    @Req() req: Request,
  ): Promise<LogoutResponseDto> {
    return this.authService.logout(userId, this.meta(req));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thông tin tài khoản đang đăng nhập' })
  @ApiResponse({ status: 200, type: AuthUserDto })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc token hết hạn' })
  me(@CurrentUser('userId') userId: string): Promise<AuthUserDto> {
    return this.authService.getProfile(userId);
  }

  private meta(req: Request): RequestMeta {
    return { ip: req.ip, userAgent: req.get('user-agent') };
  }
}
