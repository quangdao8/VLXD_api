import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'Owner@123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
