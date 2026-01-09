import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique user identifier (UUID)',
  })
  id: string;

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

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  email: string;

  @Exclude()
  password: string;

  @ApiProperty({
    example: true,
    description: 'Whether the user account is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: '2024-01-08T12:00:00.000Z',
    description: 'Account creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-08T12:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
