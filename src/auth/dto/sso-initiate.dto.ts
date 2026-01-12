import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsIn,
  Length,
  Matches,
} from 'class-validator';

export class SsoInitiateDto {
  @ApiProperty({
    description: 'Project slug identifier',
    example: 'remixer',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Project slug must contain only lowercase letters, numbers, and hyphens',
  })
  project: string;

  @ApiProperty({
    description: 'Project API key for authentication',
    example: 'sk_live_abc123...',
  })
  @IsString()
  @IsNotEmpty()
  @Length(32, 128)
  apiKey: string;

  @ApiProperty({
    description: 'Return URL for callback after authentication',
    example: 'http://localhost:4041/auth/callback',
  })
  @IsUrl({
    require_protocol: true,
    require_valid_protocol: true,
    protocols: ['http', 'https'],
    require_tld: false,
  })
  @IsNotEmpty()
  returnUrl: string;

  @ApiProperty({
    description: 'CSRF protection state parameter (required)',
    example: 'a1b2c3d4e5f6...',
    minLength: 32,
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty()
  @Length(32, 64)
  state: string;

  @ApiProperty({
    description: 'PKCE code challenge (SHA-256 hash of code verifier)',
    example: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URbuGJSstw-cM',
    minLength: 43,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @Length(43, 128)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code challenge must be base64url encoded',
  })
  codeChallenge: string;

  @ApiProperty({
    description: 'PKCE code challenge method',
    example: 'S256',
    enum: ['S256'],
  })
  @IsString()
  @IsIn(['S256'], {
    message: 'Only S256 code challenge method is supported',
  })
  codeChallengeMethod: string;
}
