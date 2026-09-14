import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePriceListDto {
  @ApiProperty({ description: 'Tên bảng giá' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Đang áp dụng', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Ngày hiệu lực (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;
}
