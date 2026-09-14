import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.OWNER, Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('revenue/daily')
  revenueDaily(@Query() q: ReportQueryDto) {
    return this.service.revenueDaily(q);
  }

  @Get('revenue/monthly')
  revenueMonthly(@Query() q: ReportQueryDto) {
    return this.service.revenueMonthly(q);
  }

  @Get('revenue/by-customer')
  revenueByCustomer(@Query() q: ReportQueryDto) {
    return this.service.revenueByCustomer(q);
  }

  @Get('debt')
  debt() {
    return this.service.debt();
  }
}
