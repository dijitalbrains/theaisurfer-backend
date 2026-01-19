import { IsInt, Min } from 'class-validator';

export class FreeWaxDto {
  @IsInt()
  userId: number;

  @IsInt()
  @Min(1)
  amount: number;
}
