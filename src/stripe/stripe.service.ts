import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(secretKey);
  }

  get client(): Stripe {
    return this.stripe;
  }

  getStripeKey(): string {
    return this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ?? '';
  }

  async getCardInfoBySourceId(sourceId: string | null) {
    if (!sourceId) {
      return null;
    }
    const paymentMethod = await this.stripe.paymentMethods.retrieve(sourceId);

    if (!('card' in paymentMethod) || !paymentMethod.card) {
      return null;
    }

    return {
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      expMonth: paymentMethod.card.exp_month,
      expYear: paymentMethod.card.exp_year,
      stripeSourceId: paymentMethod.id,
    };
  }

  async getCardInfoBySubscriptionId(subscriptionId: string) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(
        subscriptionId,
        {
          expand: ['default_payment_method'],
        },
      );

      const paymentMethod = subscription.default_payment_method;

      if (!paymentMethod || typeof paymentMethod === 'string') {
        return null;
      }

      return {
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        expMonth: paymentMethod.card?.exp_month,
        expYear: paymentMethod.card?.exp_year,
        stripeSourceId: paymentMethod.id,
      };
    } catch (error) {
      throw error;
    }
  }

  async getOrCreateCustomer(data: {
    customerId?: string | null;
    email: string;
    name: string;
    paymentMethod: string;
  }): Promise<string> {
    try {
      if (data.customerId) {
        await this.stripe.customers.retrieve(data.customerId);

        await this.stripe.paymentMethods.attach(data.paymentMethod, {
          customer: data.customerId,
        });

        await this.stripe.customers.update(data.customerId, {
          invoice_settings: {
            default_payment_method: data.paymentMethod,
          },
        });

        return data.customerId;
      } else {
        const customer = await this.stripe.customers.create({
          email: data.email,
          name: data.name,
          payment_method: data.paymentMethod,
          invoice_settings: {
            default_payment_method: data.paymentMethod,
          },
        });

        return customer.id;
      }
    } catch (error) {
      throw error;
    }
  }

  async charge(
    stripeCustomerId: string,
    amount: number, 
    description: string,
  ): Promise<void> {
    try {
      const stripeCustomer = await this.stripe.customers.retrieve(
        stripeCustomerId,
        { expand: ['invoice_settings.default_payment_method'] },
      );

      if (!stripeCustomer || stripeCustomer.deleted) {
        throw new InternalServerErrorException('Stripe customer not found');
      }

      const paymentMethod =
        stripeCustomer.invoice_settings?.default_payment_method;

      const paymentMethodId =
        typeof paymentMethod === 'string'
          ? paymentMethod
          : paymentMethod?.id;

      if (!paymentMethodId) {
         throw new InternalServerErrorException('No default payment method found');
      }

      await this.stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        description,
        off_session: true,
      });

    } catch (error) {
      throw new InternalServerErrorException(
        error?.message || 'Stripe charge failed',
      );
    }
  }

  async retrieveSubscription(subscriptionId: string) {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async attachPaymentMethodToCustomer(
    customerId: string,
    paymentMethodId: string,
  ) {
    const paymentMethod = await this.stripe.paymentMethods.attach(
      paymentMethodId,
      {
        customer: customerId,
      },
    );
    return paymentMethod as Stripe.PaymentMethod;
  }

  async updateSubscriptionPaymentMethod(
    subscriptionId: string,
    paymentMethodId: string,
  ) {
    await this.stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
    });
  }

  async updateCustomerDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ) {
    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  async cancelSubscriptionAtPeriodEnd(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: true,
      },
    );

    return subscription as Stripe.Subscription;
  }

  async resumeSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: false,
      },
    );

    return subscription as Stripe.Subscription;
  }

  async createSubscription(data: {
    customerId: string;
    priceId: string;
    quantity: number;
    paymentMethod: string;
    teamId: number;
  }): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: data.customerId,
        items: [{ price: data.priceId, quantity: data.quantity }],
        default_payment_method: data.paymentMethod,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.confirmation_secret'],
        metadata: { team_id: String(data.teamId) },
      });

      return subscription;
    } catch (error) {
      throw error;
    }
  }

  async getPricingTiers(priceId: string) {
    try {
      const price = await this.getPricing(priceId);

      const tiers =
        price.billing_scheme === 'tiered' && Array.isArray(price.tiers)
          ? price.tiers.map((tier) => ({
              upTo:
                typeof tier.up_to === 'string'
                  ? tier.up_to === 'inf'
                    ? null
                    : null
                  : (tier.up_to ?? null),
              unitAmount:
                tier.unit_amount !== null && tier.unit_amount !== undefined
                  ? tier.unit_amount / 100
                  : null,
              flatAmount:
                tier.flat_amount !== null && tier.flat_amount !== undefined
                  ? tier.flat_amount / 100
                  : null,
            }))
          : [];

      return {
        currency: price.currency,
        tiers,
        tiersMode: price.tiers_mode,
        interval: price.recurring?.interval,
      };
    } catch (error) {
      throw error;
    }
  }

  async getPricing(priceId: string): Promise<Stripe.Price> {
    const price = await this.stripe.prices.retrieve(priceId, {
      expand: ['tiers'],
    });

    return price;
  }

  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
