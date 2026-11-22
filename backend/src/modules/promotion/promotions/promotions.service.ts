import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type Promotion } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreatePromotionDto } from './dto/create-promotion.dto';

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export function evaluatePromotion(promotion: Promotion | null, subtotal: number, now: Date) {
  const rejected = (error: string) => ({ code: null, discount: 0, error });
  if (!promotion) return rejected('Không tìm thấy mã voucher.');
  if (!promotion.active) return rejected('Voucher đã ngừng áp dụng.');
  if (now < promotion.startsAt) return rejected('Voucher chưa đến thời gian áp dụng.');
  if (now >= promotion.endsAt) return rejected('Voucher đã hết hạn.');

  const minimum = Number(promotion.minSubtotal);
  if (subtotal < minimum) {
    return rejected(
      `Voucher áp dụng cho tiền hàng từ ${vnd.format(minimum)}. Bạn còn thiếu ${vnd.format(minimum - subtotal)}.`,
    );
  }
  const value = Number(promotion.value);
  const discount =
    promotion.type === 'FIXED' ? value : Number((BigInt(subtotal) * BigInt(value)) / 100n);
  return {
    code: promotion.code,
    discount: Math.min(subtotal, discount, Number(promotion.maxDiscount ?? subtotal)),
    error: null,
  };
}

@Injectable()
export class PromotionsService {
  constructor(private readonly db: PrismaService) {}

  list(forAdmin: boolean) {
    const now = new Date();
    return this.db.promotion.findMany({
      where: forAdmin ? undefined : { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { code: 'asc' },
    });
  }

  async save(input: CreatePromotionDto, id?: string) {
    const { startsAt, endsAt, ...fields } = input;
    const data = {
      ...fields,
      code: fields.code.toUpperCase(),
      maxDiscount: fields.type === 'PERCENT' ? (fields.maxDiscount ?? null) : null,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    };
    if (data.endsAt <= data.startsAt) {
      throw new BadRequestException('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
    }
    if (data.type === 'PERCENT' && data.value > 100) {
      throw new BadRequestException('Phần trăm giảm phải từ 1 đến 100.');
    }
    try {
      return await (id
        ? this.db.promotion.update({ where: { id }, data })
        : this.db.promotion.create({ data }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Mã voucher đã tồn tại.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new BadRequestException('Không tìm thấy voucher.');
      }
      throw error;
    }
  }
}
