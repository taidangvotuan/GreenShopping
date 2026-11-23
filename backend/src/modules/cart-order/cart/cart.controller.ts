import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

// Guest bị JwtAuthGuard chặn (401); role khác CUSTOMER bị RolesGuard chặn (403).
@ApiTags('Cart')
@ApiBearerAuth()
@Roles('CUSTOMER')
@Controller('cart')
export class CartController {
  constructor(private readonly service: CartService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.service.list(userId);
  }

  @Post('items')
  add(@CurrentUser('userId') userId: string, @Body() input: AddCartItemDto) {
    return this.service.add(userId, input);
  }

  @Patch('items/:id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCartItemDto,
  ) {
    return this.service.update(userId, id, input.quantity);
  }

  @Delete('items/:id')
  remove(@CurrentUser('userId') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(userId, id);
  }
}

@ApiTags('Products')
@Controller('products')
export class PurchaseCatalogController {
  constructor(private readonly service: CartService) {}

  @Public()
  @Get()
  list() {
    return this.service.catalog();
  }

  @Public()
  @Get(':id')
  product(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.product(id);
  }
}
