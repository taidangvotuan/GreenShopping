import { Module } from '@nestjs/common';
import { PaymentRefundModule } from '../payment-refund/payment-refund.module';
import { CartController, PurchaseCatalogController } from './cart/cart.controller';
import { CartService } from './cart/cart.service';
import { CheckoutController } from './checkout/checkout.controller';
import { CheckoutValidationService } from './checkout/checkout-validation.service';
import { CheckoutService } from './checkout/checkout.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';

@Module({
  imports: [PaymentRefundModule],
  controllers: [CartController, PurchaseCatalogController, CheckoutController, OrdersController],
  providers: [CartService, CheckoutValidationService, CheckoutService, OrdersService],
})
export class CartOrderModule {}
