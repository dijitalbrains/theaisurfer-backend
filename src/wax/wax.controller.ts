import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { WaxService } from './wax.service';
import { PurchaseWaxDto } from './dto/purchase-wax.dto';
import { UpdateAutoReloadDto } from './dto/update-auto-reload.dto';
import { AddPaymentMethodDto } from './dto/add-payment-method.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('wax')
@UseGuards(JwtAuthGuard)
export class WaxController {
  constructor(private readonly waxService: WaxService) {}

  @Get()
  getWaxDetails(@CurrentUser('id') userId: string) {
    return this.waxService.getWaxDetails(userId);
  }

  @Post('purchase')
  purchaseWax(
    @Body() dto: PurchaseWaxDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.waxService.purchaseWax(userId, dto.amount);
  }

  @Post('auto-reload')
  updateAutoReloadSettings(
    @Body() dto: UpdateAutoReloadDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.waxService.updateAutoReloadSettings(userId, dto);
  }

  @Post('payment-method')
  addPaymentMethod(
    @Body() dto: AddPaymentMethodDto,
    @CurrentUser('id') userId: string,
  ) {
    if (!dto.paymentMethodId) {
      throw new BadRequestException('Payment method ID is required');
    }
    return this.waxService.addPaymentMethod(userId, dto.paymentMethodId);
  }
}
