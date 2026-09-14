import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { DebtsService } from './debts.service';

@ApiTags('debts')
@ApiBearerAuth()
@Controller('debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  // Danh sách khách còn nợ (mọi role đăng nhập đều xem được).
  @Get('customers')
  findDebtors(@Query() q: PaginationQueryDto) {
    return this.debtsService.findDebtors(q);
  }

  // Sổ công nợ chi tiết của một khách.
  @Get('customers/:customerId/ledger')
  findLedger(
    @Param('customerId') customerId: string,
    @Query() q: PaginationQueryDto,
  ) {
    return this.debtsService.findLedger(customerId, q);
  }
}
