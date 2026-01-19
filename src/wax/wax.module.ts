import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WaxController } from "./wax.controller";
import { WaxService } from "./wax.service";
import { StripeModule } from "../stripe/stripe.module";
import { User } from "../users/entities/user.entity";
import { OrderModule } from "../order/order.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    StripeModule,
    OrderModule,
  ],
  controllers: [WaxController],
  providers: [WaxService],
  exports: [WaxService],
})
export class WaxModule {}