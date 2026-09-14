import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiPropertyOptional({ description: 'Mã sản phẩm; bỏ trống sẽ tự sinh' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: 'Tên sản phẩm' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Đơn vị tính: bao, cây, viên, m3...' })
  @IsString()
  unit!: string;

  @ApiPropertyOptional({ description: 'ID danh mục' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Giá vốn (đồng)', minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  costPrice?: number;

  @ApiProperty({ description: 'Giá bán mặc định (đồng)', minimum: 0 })
  @IsInt()
  @Min(0)
  defaultPrice!: number;

  @ApiPropertyOptional({ description: 'Mô tả' })
  @IsString()
  @IsOptional()
  description?: string;
}
