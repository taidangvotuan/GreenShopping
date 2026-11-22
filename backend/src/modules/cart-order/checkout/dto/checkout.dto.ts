import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../../../generated/prisma/client';
import { VN_PHONE_REGEX } from '../../../auth-user/auth/auth.constants';
import { AddCartItemDto } from '../../cart/dto/add-cart-item.dto';

export const MAX_CART_LINES = 100;
export const MAX_POINTS = 2_147_483_647;
export const MAX_TOTAL = 10 ** 15;

export function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class QuoteDto {
  @IsOptional()
  @IsObject()
  @Type(() => AddCartItemDto)
  @ValidateNested()
  buyNow?: AddCartItemDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CART_LINES)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  cartItemIds?: string[];

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(32)
  voucherCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_POINTS)
  points?: number;
}

export class DeliveryAddressDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  recipientName!: string;

  @Transform(trimString)
  @Matches(VN_PHONE_REGEX, { message: 'Số điện thoại nhận hàng không hợp lệ.' })
  phone!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  province!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  ward!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  addressLine!: string;
}

export class CheckoutDto extends QuoteDto {
  @IsUUID('4')
  requestId!: string;

  @IsDefined()
  @IsObject()
  @Type(() => DeliveryAddressDto)
  @ValidateNested()
  address!: DeliveryAddressDto;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsInt()
  @Min(0)
  @Max(MAX_TOTAL)
  expectedTotal!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CART_LINES)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ecoShopIds?: string[];
}
