import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto, paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  // Danh sách khách còn nợ + tổng công nợ toàn hệ thống.
  async findDebtors(q: PaginationQueryDto) {
    const where: Prisma.CustomerWhereInput = { currentDebt: { gt: 0 } };
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [data, total, agg] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          currentDebt: true,
        },
        skip: q.skip,
        take: q.limit,
        orderBy: { currentDebt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
      this.prisma.customer.aggregate({
        where: { currentDebt: { gt: 0 } },
        _sum: { currentDebt: true },
      }),
    ]);

    return {
      ...paginate(data, total, q.page, q.limit),
      totalDebt: Number(agg._sum.currentDebt ?? 0),
    };
  }

  // Sổ công nợ (ledger) của một khách — nguồn truy vết số dư.
  async findLedger(customerId: string, q: PaginationQueryDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, name: true, currentDebt: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    const where: Prisma.CustomerLedgerWhereInput = { customerId };
    const [entries, total] = await this.prisma.$transaction([
      this.prisma.customerLedger.findMany({
        where,
        skip: q.skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerLedger.count({ where }),
    ]);

    return { customer, ...paginate(entries, total, q.page, q.limit) };
  }
}
