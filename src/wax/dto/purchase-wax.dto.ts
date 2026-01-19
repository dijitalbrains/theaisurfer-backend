import { IsInt, Min } from 'class-validator';

export class PurchaseWaxDto {
  @IsInt()
  @Min(1)
  amount: number;
}
