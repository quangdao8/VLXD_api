import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'Từ ngày (ISO). Mặc định đầu tháng hiện tại.' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (ISO). Mặc định hiện tại.' })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ description: 'Lọc theo khách hàng.' })
  @IsUUID()
  @IsOptional()
  customerId?: string;
}
