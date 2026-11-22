import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PromotionType } from '../../../../generated/prisma/client';
import { trimString } from '../../../cart-order/checkout/dto/checkout.dto';

export class CreatePromotionDto {
  @Transform(trimString)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/, {
    message: 'Mã voucher chỉ dùng chữ, số, dấu gạch ngang hoặc gạch dưới.',
  })
  code!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsEnum(PromotionType)
  type!: PromotionType;

  @IsInt()
  @Min(1)
  @Max(999_999_999_999)
  value!: number;

  @IsInt()
  @Min(0)
  @Max(999_999_999_999)
  minSubtotal!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999_999_999_999)
  maxDiscount?: number | null;

  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt!: string;

  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt!: string;

  @IsBoolean()
  active!: boolean;
}
