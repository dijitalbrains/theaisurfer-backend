import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeService } from './stripe.service';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [ConfigModule, OrderModule],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
