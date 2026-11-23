import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { NO_WHITESPACE_REGEX, trimValue } from '../auth.constants';

export class LoginDto {
  @ApiProperty({
    example: 'customer@greenshopping.vn',
    description: 'Email hoặc số điện thoại',
  })
  @Transform(trimValue)
  @IsString({ message: 'Email/Số điện thoại phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập Email hoặc Số điện thoại' })
  // Sau khi trim 2 đầu: chặn khoảng trắng ở giữa chuỗi
  @Matches(NO_WHITESPACE_REGEX, {
    message: 'Email/Số điện thoại không được chứa khoảng trắng',
  })
  @MaxLength(255)
  identifier: string;

  @ApiProperty({ example: 'Customer@123' })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  @Matches(NO_WHITESPACE_REGEX, {
    message: 'Mật khẩu không được chứa khoảng trắng',
  })
  @MaxLength(128)
  password: string;
}
