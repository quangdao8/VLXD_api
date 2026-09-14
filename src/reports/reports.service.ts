import { Injectable } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

interface Period {
  from: Date;
  to: Date;
  customerId?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolvePeriod(q: ReportQueryDto): Period {
    const now = new Date();
    const from = q.from
      ? new Date(q.from)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = q.to ? new Date(q.to) : now;
    return { from, to, customerId: q.customerId };
  }

  private buildWhere(p: Period): Prisma.SaleWhereInput {
    const where: Prisma.SaleWhereInput = {
      status: SaleStatus.ACTIVE,
      saleDate: { gte: p.from, lte: p.to },
    };
    if (p.customerId) where.customerId = p.customerId;
    return where;
  }

  async revenueDaily(q: ReportQueryDto) {
    const p = this.resolvePeriod(q);
    const sales = await this.prisma.sale.findMany({
      where: this.buildWhere(p),
      select: { saleDate: true, totalAmount: true },
    });
    const map = new Map<string, { total: number; orders: number }>();
    for (const s of sales) {
      const key = s.saleDate.toISOString().slice(0, 10);
      const acc = map.get(key) ?? { total: 0, orders: 0 };
      acc.total += Number(s.totalAmount);
      acc.orders += 1;
      map.set(key, acc);
    }
    return [...map.entries()]
      .map(([date, v]) => ({ date, total: v.total, orders: v.orders }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async revenueMonthly(q: ReportQueryDto) {
    const p = this.resolvePeriod(q);
    const sales = await this.prisma.sale.findMany({
      where: this.buildWhere(p),
      select: { saleDate: true, totalAmount: true },
    });
    const map = new Map<string, { total: number; orders: number }>();
    for (const s of sales) {
      const key = s.saleDate.toISOString().slice(0, 7);
      const acc = map.get(key) ?? { total: 0, orders: 0 };
      acc.total += Number(s.totalAmount);
      acc.orders += 1;
      map.set(key, acc);
    }
    return [...map.entries()]
      .map(([month, v]) => ({ month, total: v.total, orders: v.orders }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async revenueByCustomer(q: ReportQueryDto) {
    const p = this.resolvePeriod(q);
    const grouped = await this.prisma.sale.groupBy({
      by: ['customerId'],
      where: this.buildWhere(p),
      _sum: { totalAmount: true },
      _count: true,
    });
    const ids = grouped.map((g) => g.customerId);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const names = new Map(customers.map((c) => [c.id, c.name]));
    return grouped
      .map((g) => ({
        customerId: g.customerId,
        customerName: names.get(g.customerId) ?? null,
        total: Number(g._sum.totalAmount ?? 0),
        orders: g._count,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async debt() {
    const customers = await this.prisma.customer.findMany({
      where: { currentDebt: { gt: 0 } },
      select: { id: true, code: true, name: true, phone: true, currentDebt: true },
      orderBy: { currentDebt: 'desc' },
    });
    const data = customers.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      phone: c.phone,
      currentDebt: Number(c.currentDebt),
    }));
    const totalDebt = data.reduce((sum, c) => sum + c.currentDebt, 0);
    return { data, totalDebt };
  }
}
