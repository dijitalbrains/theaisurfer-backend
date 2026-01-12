import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'remixer', required: false })
  @IsString()
  @IsOptional()
  projectSlug?: string;

  @ApiProperty({
    example: 'https://remixer.theaisurfer.com/callback',
    required: false,
  })
  @IsUrl({ require_tld: false })
  @IsOptional()
  redirectUrl?: string;
}
