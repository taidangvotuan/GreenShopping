import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PaymentStatus } from '../../../generated/prisma/client';
import { MockPaymentResultDto } from './dto/payment-callback.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Roles('ADMIN')
  @Get('manage')
  manage(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('status', new ParseEnumPipe(PaymentStatus, { optional: true })) status?: PaymentStatus,
  ) {
    return this.service.manage(Math.max(1, Math.min(100_000, page)), status);
  }

  @Post(':orderId/mock-result')
  mockResult(
    @CurrentUser('userId') userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() input: MockPaymentResultDto,
  ) {
    return this.service.resolve(userId, orderId, input.outcome);
  }
}
