import { ApiProperty } from '@nestjs/swagger';

export class TokenValidationUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;
}

export class TokenValidationResponseDto {
  @ApiProperty()
  valid: boolean;

  @ApiProperty({ type: TokenValidationUserDto })
  user: TokenValidationUserDto;

  @ApiProperty({ required: false })
  projectSlug?: string;
}
