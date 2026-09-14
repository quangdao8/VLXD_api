import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PriceListItemInputDto {
  @ApiProperty({ description: 'ID sản phẩm', format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ description: 'Giá (đồng VND, số nguyên)', minimum: 0 })
  @IsInt()
  @Min(0)
  price!: number;
}

export class UpsertPriceListItemsDto {
  @ApiProperty({ type: [PriceListItemInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PriceListItemInputDto)
  items!: PriceListItemInputDto[];
}
