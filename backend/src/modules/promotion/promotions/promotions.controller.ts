import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { PromotionsService } from './promotions.service';

@ApiTags('Promotions')
@ApiBearerAuth()
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Get()
  list() {
    return this.service.list(false);
  }

  @Roles('ADMIN')
  @Get('manage')
  manage() {
    return this.service.list(true);
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() input: CreatePromotionDto) {
    return this.service.save(input);
  }

  @Roles('ADMIN')
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: CreatePromotionDto) {
    return this.service.save(input, id);
  }
}
