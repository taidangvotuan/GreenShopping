import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  NO_WHITESPACE_REGEX,
  PASSWORD_REGEX,
  VN_PHONE_REGEX,
} from '../auth.constants';

/**
 * Đăng ký tài khoản CUSTOMER — khớp các cột của bảng `user` trong ERD.
 * Không nhận role (luôn CUSTOMER), không nhận ngày sinh/địa chỉ.
 */
export class RegisterDto {
  @ApiProperty({ example: 'Nguyễn Văn A', maxLength: 150, description: 'user.full_name' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(150, { message: 'Họ tên tối đa 150 ký tự' })
  fullName: string;

  @ApiProperty({ example: 'nguyenvana@example.com', maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsString({ message: 'Email phải là chuỗi' })
  @Matches(NO_WHITESPACE_REGEX, { message: 'Email không được chứa khoảng trắng' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(255, { message: 'Email tối đa 255 ký tự' })
  email: string;

  @ApiProperty({ example: '0912345678', maxLength: 20, description: '0xxxxxxxxx hoặc +84xxxxxxxxx' })
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @Matches(VN_PHONE_REGEX, {
    message: 'Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0 hoặc theo dạng +84, không chứa khoảng trắng',
  })
  @MaxLength(20)
  phone: string;

  @ApiProperty({ example: 'GreenShop@2026', minLength: 8 })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(128, { message: 'Mật khẩu tối đa 128 ký tự' })
  @Matches(PASSWORD_REGEX, {
    message:
      'Mật khẩu phải có chữ hoa, chữ thường, chữ số, ký tự đặc biệt (!@#$%^&*) và không chứa khoảng trắng',
  })
  password: string;
}
