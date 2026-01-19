import {
  IsBoolean,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateAutoReloadDto {
  
  @IsBoolean()
  autoReloadEnabled: boolean;

  @ValidateIf(o => o.autoReloadEnabled === true)
  @IsInt()
  @Min(1)
  reloadThreshold: number;

  @ValidateIf(o => o.autoReloadEnabled === true)
  @IsInt()
  @Min(1)
  reloadAmount: number;
}
