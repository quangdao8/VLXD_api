import { ApiProperty } from '@nestjs/swagger';
import { OmitType, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

/** Cập nhật thông tin cơ bản; KHÔNG cho đổi username/password qua đây. */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['username', 'password'] as const),
) {}

/** Đổi vai trò qua endpoint riêng. */
export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;
}
