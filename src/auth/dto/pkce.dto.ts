import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsIn,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
    example: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
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

export class AuthorizeCompleteDto {
  @ApiProperty({
    description: 'SSO session ID',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64)
  sessionId: string;
}

export class TokenExchangeDto {
  @ApiProperty({
    description: 'Authorization code from callback',
    example: 'auth_abc123...',
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 128)
  code: string;

  @ApiProperty({
    description: 'PKCE code verifier (original random string)',
    example: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    minLength: 43,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @Length(43, 128)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code verifier must be base64url encoded',
  })
  codeVerifier: string;

  @ApiProperty({
    description: 'Project slug for validation',
    example: 'remixer',
  })
  @IsString()
  @IsNotEmpty()
  projectSlug: string;

  @ApiProperty({
    description: 'Project API key for authentication',
    example: 'sk_live_abc123...',
  })
  @IsString()
  @IsNotEmpty()
  @Length(32, 128)
  apiKey: string;

  @ApiProperty({
    description: 'Redirect URI used in authorization request',
    example: 'http://localhost:4041/auth/callback',
  })
  @IsUrl({
    require_protocol: true,
    require_valid_protocol: true,
    protocols: ['http', 'https'],
    require_tld: false,
  })
  @IsNotEmpty()
  redirectUri: string;
}

export class AuthorizationCodeResponseDto {
  @ApiProperty({
    description: 'Authorization code for token exchange',
    example: 'auth_abc123...',
  })
  code: string;

  @ApiProperty({
    description: 'State parameter for CSRF protection',
    example: 'a1b2c3d4e5f6...',
  })
  state: string;

  @ApiProperty({
    description: 'Redirect URI to send code to',
    example: 'http://localhost:4041/auth/callback',
  })
  redirectUri: string;
}

export class TokenResponseDto {
  @ApiProperty({
    description: 'Access token (JWT)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token (JWT)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Token type',
    example: 'bearer',
  })
  tokenType: string;

  @ApiProperty({
    description: 'Access token expiration time in seconds',
    example: 900,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}
