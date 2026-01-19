import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeService } from '../stripe/stripe.service';
import { UpdateAutoReloadDto } from './dto/update-auto-reload.dto';
import { User } from '../users/entities/user.entity';
import { OrderService } from '../order/order.service';

@Injectable()
export class WaxService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly orderService: OrderService,
  ) {}

  async getWaxDetails(userId: number) {
    const user = await this.userRepo.findOneBy({ id: userId.toString() });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      remainingCredits: user.hasUnlimitedCredits
        ? 'Unlimited'
        : user.purchasedCredits,

      userCard: user.stripeSourceId
        ? await this.stripeService.getCardInfoBySourceId(user.stripeSourceId)
        : null,

      waxPerCent: Number(this.configService.get('CREDITS_PER_CENT') || 36),
      autoReloadSettings: {
        autoReload: user.autoReload,
        reloadThreshold: user.reloadThreshold,
        reloadAmount: user.reloadAmount,
      },
    };
  }

  async purchaseWax(
    userId: number,
    amount: number,
    type: 'wax_purchase' | 'wax_restock' = 'wax_purchase',
  ) {
    if (amount > 100) {
      throw new BadRequestException('Maximum purchase limit is $100');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId.toString() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.stripeCustomerId || !user.stripeSourceId) {
      throw new BadRequestException('User does not have stripe information');
    }

    const cents = amount * 100;

    await this.stripeService.charge(
      user.stripeCustomerId,
      cents,
      `Purchase $${amount} wax`,
    );

    const waxPerCent = Number(this.configService.get('CREDITS_PER_CENT') || 36);
    const credits = cents * waxPerCent;

    await this.userRepo.increment(
      { id: userId.toString() },
      'purchasedCredits',
      credits,
    );

    await this.orderService.create({
      userId,
      type: type,
      quantity: credits,
      price: amount,
    });

    return { message: 'Wax purchase successfully' };
  }

  async updateAutoReload(userId: number, dto: UpdateAutoReloadDto) {
    await this.userRepo.update(userId, {
      autoReload: dto.autoReloadEnabled,
      reloadThreshold: dto.reloadThreshold,
      reloadAmount: dto.reloadAmount,
    });

    return { message: 'Auto reload settings updated successfully' };
  }

  async freeWax(userId: number, amount: number) {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId.toString() },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const waxPerCent = Number(
        this.configService.get('CREDITS_PER_CENT') || 36,
      );
      const amountInCents = amount * 100;
      const credits = amountInCents * waxPerCent;

      await this.userRepo.update(userId, {
        purchasedCredits: (user.purchasedCredits || 0) + credits,
      });

      return {
        message: 'Wax added successfully',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to add wax: ' + error.message,
      );
    }
  }

  async addCard(userId: number, paymentMethodId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId.toString() },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const stripeCustomerId = await this.stripeService.getOrCreateCustomer({
      customerId: user.stripeCustomerId,
      email: user.email,
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      paymentMethod: paymentMethodId,
    });

    await this.userRepo.update(userId, {
      stripeCustomerId,
      stripeSourceId: paymentMethodId,
    });

    return { message: 'Card added successfully' };
  }
}
