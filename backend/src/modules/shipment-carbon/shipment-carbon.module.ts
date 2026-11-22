import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments/shipments.controller';
import { ShipmentsService } from './shipments/shipments.service';

@Module({ controllers: [ShipmentsController], providers: [ShipmentsService] })
export class ShipmentCarbonModule {}
