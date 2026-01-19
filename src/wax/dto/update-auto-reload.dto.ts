import { IsBoolean, IsInt, Min, ValidateIf } from 'class-validator';

export class UpdateAutoReloadDto {
  @IsBoolean()
  enabled: boolean;

  @ValidateIf((o) => o.enabled === true)
  @IsInt()
  @Min(1)
  threshold: number;

  @ValidateIf((o) => o.enabled === true)
  @IsInt()
  @Min(1)
  amount: number;
}
