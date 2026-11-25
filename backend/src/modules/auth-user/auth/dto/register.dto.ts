import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
} from 'class-validator';
import {
  collapseSpaces,
  isValidBirthDate,
  NO_WHITESPACE_REGEX,
  PASSWORD_REGEX,
  trimValue,
  VN_PHONE_REGEX,
} from '../auth.constants';

/**
 * Đăng ký tài khoản khách hàng.
 *
 * SECURITY (BM-06): DTO cố ý KHÔNG có trường `role`. ValidationPipe toàn cục bật
 * `whitelist + forbidNonWhitelisted` → request gửi kèm `role` (hay field lạ bất kỳ) bị từ chối 400.
 * Vai trò do server gán cố định: PUBLIC_REGISTRATION_ROLE (CUSTOMER).
 *
 * Quy tắc khoảng trắng:
 *  - Mọi trường: trim 2 đầu, chuỗi rỗng / toàn khoảng trắng bị từ chối.
 *  - Họ tên, Địa chỉ: cho phép khoảng trắng giữa các từ (nhiều khoảng trắng liên tiếp được gộp thành 1).
 *  - Email, SĐT: trim 2 đầu, CẤM khoảng trắng ở giữa chuỗi.
 *  - Mật khẩu: KHÔNG trim (tránh âm thầm đổi mật khẩu) — cấm khoảng trắng ở MỌI vị trí.
 *
 * Thứ tự decorator: class-validator chạy tất cả, lỗi đầu tiên của mỗi trường hiển thị ở FE.
 */
export class RegisterDto {
  @ApiProperty({
    example: 'Nguyễn Văn A',
    maxLength: 150,
    description: 'user.full_name',
  })
  @Transform(collapseSpaces)
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(150, { message: 'Họ tên tối đa 150 ký tự' })
  fullName: string;

  @ApiProperty({
    example: '2000-01-31',
    description: 'YYYY-MM-DD, không lớn hơn ngày hiện tại',
  })
  @Transform(trimValue)
  @IsString({ message: 'Ngày sinh phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập ngày sinh' })
  @ValidateBy(
    {
      name: 'isValidBirthDate',
      validator: { validate: (value) => isValidBirthDate(value) },
    },
    { message: 'Ngày sinh không hợp lệ hoặc lớn hơn ngày hiện tại' },
  )
  dateOfBirth: string;

  @ApiProperty({
    example: '0912345678',
    maxLength: 20,
    description: '0xxxxxxxxx hoặc +84xxxxxxxxx',
  })
  @Transform(trimValue)
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  @Matches(NO_WHITESPACE_REGEX, {
    message: 'Số điện thoại không được chứa khoảng trắng',
  })
  @Matches(VN_PHONE_REGEX, {
    message: 'Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0 hoặc theo dạng +84',
  })
  @MaxLength(20)
  phone: string;

  @ApiProperty({
    example: '24 Nguyễn Hữu Cảnh, P. Thạnh Mỹ Tây, TP. Hồ Chí Minh',
    maxLength: 255,
  })
  @Transform(collapseSpaces)
  @IsString({ message: 'Địa chỉ phải là chuỗi' })
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  @MaxLength(255, { message: 'Địa chỉ tối đa 255 ký tự' })
  address: string;

  @ApiProperty({ example: 'nguyenvana@example.com', maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString({ message: 'Email phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập email' })
  @Matches(NO_WHITESPACE_REGEX, {
    message: 'Email không được chứa khoảng trắng',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(255, { message: 'Email tối đa 255 ký tự' })
  email: string;

  @ApiProperty({ example: 'GreenShop@2026', minLength: 8 })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(128, { message: 'Mật khẩu tối đa 128 ký tự' })
  @Matches(PASSWORD_REGEX, {
    message:
      'Mật khẩu phải có chữ hoa, chữ thường, chữ số, ký tự đặc biệt (!@#$%^&*) và không chứa khoảng trắng',
  })
  password: string;

  @ApiProperty({
    example: 'GreenShop@2026',
    description: 'Phải trùng khớp chính xác với password',
  })
  @IsString({ message: 'Mật khẩu xác nhận phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập lại mật khẩu' })
  @ValidateBy(
    {
      name: 'matchesPassword',
      validator: {
        validate: (value, args) =>
          value === (args?.object as { password?: unknown } | undefined)?.password,
      },
    },
    { message: 'Mật khẩu xác nhận không khớp' },
  )
  confirmPassword: string;
}
