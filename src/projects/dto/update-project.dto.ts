import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsArray, IsOptional } from 'class-validator';

export class UpdateProjectDto {
  @ApiProperty({ example: 'Remixer Updated', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    example: ['https://remixer.theaisurfer.com/callback'],
    required: false,
  })
  @IsArray()
  @IsOptional()
  allowedRedirectUrls?: string[];

  @ApiProperty({
    example: 'sk_remixer_abc123...',
    required: false,
    description: 'API key for SSO authentication (admin only)',
  })
  @IsString()
  @IsOptional()
  apiKey?: string;
}
