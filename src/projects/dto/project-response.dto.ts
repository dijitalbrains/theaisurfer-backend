import { ApiProperty } from '@nestjs/swagger';

export class ProjectResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique project identifier (UUID)',
  })
  id: string;

  @ApiProperty({
    example: 'Remixer',
    description: 'Project display name',
  })
  name: string;

  @ApiProperty({
    example: 'remixer',
    description: 'URL-friendly project identifier',
  })
  slug: string;

  @ApiProperty({
    example: true,
    description: 'Whether the project is currently active',
  })
  isActive: boolean;

  @ApiProperty({
    example: [
      'https://remixer.theaisurfer.com/callback',
      'https://remixer.theaisurfer.com/auth',
    ],
    description: 'Whitelisted redirect URLs for authentication callbacks',
    type: [String],
    required: false,
  })
  allowedRedirectUrls?: string[];

  @ApiProperty({
    example: '2024-01-08T12:00:00.000Z',
    description: 'Project creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-08T12:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
