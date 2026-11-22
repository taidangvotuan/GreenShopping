import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SubOrderStatus } from '../../../../generated/prisma/client';
import { trimString } from '../../../cart-order/checkout/dto/checkout.dto';

export class UpdateShipmentStatusDto {
  @IsEnum(SubOrderStatus)
  expectedStatus!: SubOrderStatus;

  @IsEnum(SubOrderStatus)
  status!: SubOrderStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  note?: string;
}
