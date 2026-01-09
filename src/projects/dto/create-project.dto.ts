import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Remixer' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'remixer' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({
    example: ['https://remixer.theaisurfer.com/callback'],
    required: false,
  })
  @IsArray()
  @IsOptional()
  allowedRedirectUrls?: string[];
}
