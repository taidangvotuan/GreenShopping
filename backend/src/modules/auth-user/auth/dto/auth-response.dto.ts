import { ApiProperty } from '@nestjs/swagger';

/** Thông tin user trả về client — KHÔNG bao giờ chứa password_hash. */
export class AuthUserDto {
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty({ nullable: true, type: String }) phone: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING'] }) status: string;
  @ApiProperty({ type: [String], example: ['CUSTOMER'] }) roles: string[];
  @ApiProperty({ type: [String], example: ['product:read'] }) permissions: string[];
  @ApiProperty() createdAt: Date;
}

export class LoginResponseDto {
  @ApiProperty() access_token: string;
  @ApiProperty({ example: 'Bearer' }) token_type: string;
  @ApiProperty({ example: '30m' }) expires_in: string;
  @ApiProperty({ type: AuthUserDto }) user: AuthUserDto;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true }) loggedOut: boolean;
}
