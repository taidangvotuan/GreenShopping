import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { CheckoutService } from './checkout.service';
import { CheckoutDto, QuoteDto } from './dto/checkout.dto';

@ApiTags('Checkout')
@ApiBearerAuth()
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly service: CheckoutService,
    private readonly db: PrismaService,
  ) {}

  @Get('addresses')
  addresses(@CurrentUser('userId') userId: string) {
    return this.db.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
  }

  @Post('quote')
  quote(@CurrentUser('userId') userId: string, @Body() input: QuoteDto) {
    return this.service.quote(userId, input);
  }

  @Post()
  place(@CurrentUser('userId') userId: string, @Body() input: CheckoutDto) {
    return this.service.place(userId, input);
  }
}
