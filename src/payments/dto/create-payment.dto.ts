import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional({ description: 'Thu cho một đơn cụ thể (tùy chọn)' })
  @IsUUID()
  @IsOptional()
  saleId?: string;

  @ApiProperty({ description: 'Số tiền thu (đồng)' })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  paidAt?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'ID chống trùng khi mạng chập chờn' })
  @IsString()
  @IsOptional()
  clientRequestId?: string;
}
