import { Controller, Get, Post, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { WaxService } from './wax.service';
import { PurchaseWaxDto } from './dto/purchase-wax.dto';
import { FreeWaxDto } from './dto/free-wax.dto';
import { UpdateAutoReloadDto } from './dto/update-auto-reload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('wax')
@UseGuards(JwtAuthGuard)
export class WaxController {
  constructor(private readonly waxService: WaxService) {}

  @Get()
  getWaxDashboard(@Req() req) {
    return this.waxService.getWaxDetails(req.user.id);
  }

  @Post('purchase')
  purchase(@Body() dto: PurchaseWaxDto, @Req() req) {
    return this.waxService.purchaseWax(req.user.id, dto.amount);
  }

  @Post('free')
  free(@Body() dto: FreeWaxDto) {
    return this.waxService.freeWax(dto.userId, dto.amount);
  }

  @Post('auto-reload')
  updateAutoReload(@Body() dto: UpdateAutoReloadDto, @Req() req) {
    return this.waxService.updateAutoReload(req.user.id, dto);
  }
  @Post('add-card')
  addCard(@Body('paymentMethodId') paymentMethodId: string, @Req() req) {
    if (!paymentMethodId) {
        throw new BadRequestException('Payment method ID is required');
    }
    return this.waxService.addCard(req.user.id, paymentMethodId);
  }
}
