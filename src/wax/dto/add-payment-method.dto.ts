import { IsString } from 'class-validator';

export class AddPaymentMethodDto {
  @IsString()
  paymentMethodId: string;
}
