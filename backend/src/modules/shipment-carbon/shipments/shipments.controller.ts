import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { SubOrderStatus } from '../../../generated/prisma/client';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ShipmentsService } from './shipments.service';

@ApiTags('Shipments')
@ApiBearerAuth()
@Roles('ADMIN', 'STAFF', 'SELLER')
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly service: ShipmentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('status', new ParseEnumPipe(SubOrderStatus, { optional: true })) status?: SubOrderStatus,
  ) {
    return this.service.list(user, Math.max(1, Math.min(100_000, page)), status);
  }

  @Patch(':subOrderId/status')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('subOrderId', ParseUUIDPipe) id: string,
    @Body() input: UpdateShipmentStatusDto,
  ) {
    return this.service.update(user, id, input);
  }
}
