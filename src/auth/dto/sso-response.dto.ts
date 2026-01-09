import { ApiProperty } from '@nestjs/swagger';

export class SsoUserDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  lastName: string;
}

export class SsoResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT refresh token',
  })
  refreshToken: string;

  @ApiProperty({
    type: SsoUserDto,
    description: 'User information',
  })
  user: SsoUserDto;

  @ApiProperty({
    example: 'csrf_token_abc123',
    description: 'State parameter passed from initial request',
    required: false,
  })
  state?: string;
}

export class SsoSessionDto {
  @ApiProperty({
    example: 'remixer',
    description: 'Project slug',
  })
  projectSlug: string;

  @ApiProperty({
    example: 'Remixer',
    description: 'Project display name',
  })
  projectName: string;

  @ApiProperty({
    example: 'https://remixer.theaisurfer.com/auth/callback',
    description: 'Return URL',
  })
  returnUrl: string;

  @ApiProperty({
    example: 'csrf_token_abc123',
    description: 'CSRF state parameter',
    required: false,
  })
  state?: string;
}
