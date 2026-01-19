import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { StripeService } from '../stripe/stripe.service';
import { UpdateAutoReloadDto } from './dto/update-auto-reload.dto';
import { User } from '../users/entities/user.entity';
import { OrderService } from '../order/order.service';

const MAX_PURCHASE_AMOUNT = 100;
const DEFAULT_CREDITS_PER_CENT = 36;

@Injectable()
export class WaxService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly orderService: OrderService,
  ) {}

  async getWaxDetails(userId: string) {
    const user = await this.findUserById(userId);

    const userStripeSource = user.stripeSourceId
      ? await this.stripeService.getCardInfoBySourceId(user.stripeSourceId)
      : null;

    return {
      remainingCredits: user.hasUnlimitedCredits
        ? 'Unlimited'
        : user.purchasedCredits,
      userStripeSource,
      creditsPerCent: this.getCreditsPerCent(),
      autoReloadSettings: {
        enabled: user.autoReload,
        threshold: user.reloadThreshold,
        amount: user.reloadAmount,
      },
    };
  }

  async purchaseWax(
    userId: string,
    amountInDollars: number,
    orderType: 'wax_purchase' | 'wax_restock' = 'wax_purchase',
  ) {
    this.validatePurchaseAmount(amountInDollars);

    const user = await this.findUserById(userId);
    this.validateUserHasPaymentMethod(user);

    const amountInCents = this.convertDollarsToCents(amountInDollars);
    const creditsToAdd = this.calculateCredits(amountInCents);

    await this.chargeUser(user, amountInCents, amountInDollars);
    await this.addCreditsToUser(user, creditsToAdd);
    await this.createOrder(userId, orderType, creditsToAdd, amountInDollars);

    return { message: 'Wax purchased successfully' };
  }

  async updateAutoReloadSettings(userId: string, dto: UpdateAutoReloadDto) {
    await this.userRepository.update(userId, {
      autoReload: dto.enabled,
      reloadThreshold: dto.threshold,
      reloadAmount: dto.amount,
    });

    return { message: 'Auto reload settings updated successfully' };
  }

  async addPaymentMethod(userId: string, paymentMethodId: string) {
    const user = await this.findUserById(userId);

    const stripeCustomerId = await this.stripeService.getOrCreateCustomer({
      customerId: user.stripeCustomerId,
      email: user.email,
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      paymentMethod: paymentMethodId,
    });

    await this.userRepository.update(userId, {
      stripeCustomerId,
      stripeSourceId: paymentMethodId,
    });

    return { message: 'Payment method added successfully' };
  }

  private async findUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private validateUserHasPaymentMethod(user: User): void {
    if (!user.stripeCustomerId || !user.stripeSourceId) {
      throw new BadRequestException('User does not have a payment method');
    }
  }

  private validatePurchaseAmount(amount: number): void {
    if (amount > MAX_PURCHASE_AMOUNT) {
      throw new BadRequestException(
        `Maximum purchase limit is $${MAX_PURCHASE_AMOUNT}`,
      );
    }
  }

  private async chargeUser(
    user: User,
    amountInCents: number,
    amountInDollars: number,
  ): Promise<void> {
    await this.stripeService.charge(
      user.stripeCustomerId!,
      amountInCents,
      `Purchase $${amountInDollars} wax`,
    );
  }

  private convertDollarsToCents(dollars: number): number {
    return dollars * 100;
  }

  private getCreditsPerCent(): number {
    return Number(
      this.configService.get('CREDITS_PER_CENT') || DEFAULT_CREDITS_PER_CENT,
    );
  }

  private calculateCredits(amountInCents: number): number {
    return amountInCents * this.getCreditsPerCent();
  }

  private async addCreditsToUser(user: User, credits: number): Promise<void> {
    user.purchasedCredits = Number(user.purchasedCredits || 0) + Number(credits);
    await this.userRepository.save(user);
  }

  private async createOrder(
    userId: string,
    orderType: string,
    quantity: number,
    price: number,
  ): Promise<void> {
    await this.orderService.create({
      userId,
      type: orderType,
      quantity,
      price,
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async restockCredits(): Promise<void> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.stripe_customer_id IS NOT NULL')
      .andWhere('user.stripe_source_id IS NOT NULL')
      .andWhere('user.auto_reload = true')
      .andWhere('user.purchased_credits < user.reload_threshold');

    const users = await queryBuilder.getMany();

    for (const user of users) {
      try {
        await this.purchaseWax(user.id, user.reloadAmount, 'wax_restock');
      } catch (error) {
      }
    }
  }
}
