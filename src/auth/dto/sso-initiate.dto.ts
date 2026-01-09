import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl, IsOptional } from 'class-validator';

export class SsoInitiateDto {
  @ApiProperty({
    example: 'remixer',
    description: 'Project slug identifier',
  })
  @IsString()
  @IsNotEmpty()
  project: string;

  @ApiProperty({
    example: 'sk_live_abc123xyz789...',
    description: 'Project API key for authentication',
  })
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ApiProperty({
    example: 'https://remixer.theaisurfer.com/auth/callback',
    description: 'URL to redirect back to after authentication (must be whitelisted)',
  })
  @IsUrl()
  @IsNotEmpty()
  returnUrl: string;

  @ApiProperty({
    example: 'csrf_token_abc123',
    description: 'Optional state parameter for CSRF protection',
    required: false,
  })
  @IsString()
  @IsOptional()
  state?: string;
}
