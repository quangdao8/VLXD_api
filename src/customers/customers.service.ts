import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus, SaleStatus } from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: QueryCustomerDto) {
    const where: Prisma.CustomerWhereInput = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.debtOnly) {
      where.currentDebt = { gt: 0 };
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip: q.skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return paginate(data, total, q.page, q.limit);
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    const [totalOrders, agg] = await this.prisma.$transaction([
      this.prisma.sale.count({
        where: { customerId: id, status: SaleStatus.ACTIVE },
      }),
      this.prisma.sale.aggregate({
        where: { customerId: id, status: SaleStatus.ACTIVE },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      ...customer,
      summary: {
        totalOrders,
        totalBought: agg._sum.totalAmount ?? BigInt(0),
        currentDebt: customer.currentDebt,
      },
    };
  }

  async create(dto: CreateCustomerDto) {
    const code = dto.code ?? (await this.generateCode());
    return this.prisma.customer.create({
      data: {
        code,
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        note: dto.note,
      },
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.ensureExists(id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        note: dto.note,
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.customer.update({
      where: { id },
      data: { status: RecordStatus.INACTIVE },
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Không tìm thấy khách hàng');
  }

  private async generateCode(): Promise<string> {
    const count = await this.prisma.customer.count();
    return `KH${String(count + 1).padStart(4, '0')}`;
  }
}
