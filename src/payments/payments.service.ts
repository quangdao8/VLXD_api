import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RecordStatus,
  SaleStatus,
} from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { buildDailyCode, dayRange } from '../common/utils/code.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';

const PAYMENT_INCLUDE = {
  customer: { select: { id: true, code: true, name: true } },
  sale: { select: { id: true, code: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto, user: AuthUser) {
    if (dto.clientRequestId) {
      const existing = await this.prisma.payment.findUnique({
        where: { clientRequestId: dto.clientRequestId },
        include: PAYMENT_INCLUDE,
      });
      if (existing) return existing;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer || customer.status !== RecordStatus.ACTIVE) {
      throw new NotFoundException('Khách hàng không tồn tại hoặc đã bị vô hiệu hóa');
    }

    const amount = BigInt(dto.amount);
    if (amount > customer.currentDebt) {
      throw new BadRequestException(
        'Số tiền thu vượt quá công nợ hiện tại của khách',
      );
    }

    // Nếu thu cho một đơn cụ thể: kiểm tra đơn hợp lệ và không vượt nợ đơn.
    const sale = dto.saleId
      ? await this.prisma.sale.findUnique({ where: { id: dto.saleId } })
      : null;
    if (dto.saleId) {
      if (!sale || sale.customerId !== customer.id) {
        throw new BadRequestException('Đơn hàng không thuộc khách hàng này');
      }
      if (sale.status !== SaleStatus.ACTIVE) {
        throw new BadRequestException('Không thể thu tiền cho đơn đã hủy');
      }
      if (amount > sale.debtAmount) {
        throw new BadRequestException('Số tiền thu vượt quá nợ của đơn này');
      }
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const { start, end } = dayRange(paidAt);
      const seq =
        (await tx.payment.count({
          where: { paidAt: { gte: start, lt: end } },
        })) + 1;

      const payment = await tx.payment.create({
        data: {
          code: buildDailyCode('TT', paidAt, seq),
          customerId: customer.id,
          saleId: sale?.id,
          amount,
          method: dto.method ?? PaymentMethod.CASH,
          paidAt,
          createdById: user.id,
          note: dto.note,
          clientRequestId: dto.clientRequestId,
        },
        include: PAYMENT_INCLUDE,
      });

      const balance = customer.currentDebt - amount;
      await tx.customerLedger.create({
        data: {
          customerId: customer.id,
          entryType: LedgerEntryType.PAYMENT,
          refType: 'payment',
          refId: payment.id,
          credit: amount,
          balanceAfter: balance,
          createdById: user.id,
        },
      });
      await tx.customer.update({
        where: { id: customer.id },
        data: { currentDebt: balance },
      });

      // Cập nhật trạng thái đơn nếu thu theo đơn.
      if (sale) {
        const newPaid = sale.paidAmount + amount;
        const newDebt = sale.totalAmount - newPaid;
        const paymentStatus =
          newDebt <= 0n ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: newPaid,
            debtAmount: newDebt,
            paymentStatus,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'payment.create',
          entity: 'Payment',
          entityId: payment.id,
          changes: { amount: dto.amount, saleId: sale?.id ?? null },
        },
      });

      return payment;
    });
  }

  async findAll(q: QueryPaymentDto) {
    const where: Prisma.PaymentWhereInput = {};
    if (q.customerId) where.customerId = q.customerId;
    if (q.saleId) where.saleId = q.saleId;
    if (q.from || q.to) {
      where.paidAt = {};
      if (q.from) where.paidAt.gte = new Date(q.from);
      if (q.to) where.paidAt.lte = new Date(q.to);
    }
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { customer: { name: { contains: q.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        skip: q.skip,
        take: q.limit,
        orderBy: { paidAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(data, total, q.page, q.limit);
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: PAYMENT_INCLUDE,
    });
    if (!payment) throw new NotFoundException('Không tìm thấy phiếu thu');
    return payment;
  }
}
