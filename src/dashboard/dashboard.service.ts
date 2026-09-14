import { Injectable } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { dayRange } from '../common/utils/code.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const { start, end } = dayRange(new Date());
    const todayActive = {
      saleDate: { gte: start, lt: end },
      status: SaleStatus.ACTIVE,
    };

    const [
      revenueTodayAgg,
      ordersToday,
      customersTodayGroups,
      collectedTodayAgg,
      totalDebtAgg,
      debtorsCount,
      recentSales,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: todayActive,
        _sum: { totalAmount: true },
      }),
      this.prisma.sale.count({ where: todayActive }),
      this.prisma.sale.groupBy({
        by: ['customerId'],
        where: todayActive,
      }),
      this.prisma.payment.aggregate({
        where: { paidAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      this.prisma.customer.aggregate({
        _sum: { currentDebt: true },
      }),
      this.prisma.customer.count({
        where: { currentDebt: { gt: 0 } },
      }),
      this.prisma.sale.findMany({
        where: { status: SaleStatus.ACTIVE },
        orderBy: { saleDate: 'desc' },
        take: 5,
        include: { customer: { select: { name: true } } },
      }),
    ]);

    return {
      revenueToday: Number(revenueTodayAgg._sum.totalAmount ?? 0),
      ordersToday,
      customersToday: customersTodayGroups.length,
      collectedToday: Number(collectedTodayAgg._sum.amount ?? 0),
      totalDebt: Number(totalDebtAgg._sum.currentDebt ?? 0),
      debtorsCount,
      recentSales,
    };
  }
}
