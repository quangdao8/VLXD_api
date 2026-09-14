import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryCustomerDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Chỉ lấy khách còn nợ (currentDebt > 0)' })
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  @IsOptional()
  debtOnly?: boolean;
}
