import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RecordStatus,
  Role,
  SaleStatus,
} from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { buildDailyCode, dayRange } from '../common/utils/code.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { QuerySaleDto } from './dto/query-sale.dto';

/** Trạng thái thanh toán suy ra từ tổng tiền và số đã trả. */
function derivePaymentStatus(total: number, paid: number): PaymentStatus {
  if (paid <= 0) return PaymentStatus.UNPAID;
  if (paid >= total) return PaymentStatus.PAID;
  return PaymentStatus.PARTIAL;
}

const SALE_INCLUDE = {
  items: true,
  customer: { select: { id: true, code: true, name: true, phone: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSaleDto, user: AuthUser) {
    // Idempotency: cùng clientRequestId -> trả đơn đã tạo, không tạo trùng.
    if (dto.clientRequestId) {
      const existing = await this.prisma.sale.findUnique({
        where: { clientRequestId: dto.clientRequestId },
        include: SALE_INCLUDE,
      });
      if (existing) return existing;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer || customer.status !== RecordStatus.ACTIVE) {
      throw new NotFoundException('Khách hàng không tồn tại hoặc đã bị vô hiệu hóa');
    }

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Backend tự tính tiền — KHÔNG tin client (docs §17).
    let subtotal = 0;
    const items = dto.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product || product.status !== RecordStatus.ACTIVE) {
        throw new BadRequestException(
          `Sản phẩm ${item.productId} không tồn tại hoặc đã bị vô hiệu hóa`,
        );
      }
      const lineTotal = Math.round(item.quantity * item.unitPrice);
      subtotal += lineTotal;
      return {
        productId: product.id,
        productName: product.name, // snapshot
        unit: product.unit, // snapshot
        quantity: new Prisma.Decimal(item.quantity),
        unitPrice: BigInt(item.unitPrice), // snapshot
        lineTotal: BigInt(lineTotal),
      };
    });

    const discount = dto.discount ?? 0;
    if (discount > subtotal) {
      throw new BadRequestException('Giảm giá không được lớn hơn tạm tính');
    }
    const total = subtotal - discount;

    const paid = dto.paidAmount ?? 0;
    if (paid > total) {
      throw new BadRequestException(
        'Số tiền trả cho đơn không được lớn hơn tổng tiền',
      );
    }
    const debt = total - paid;
    const paymentStatus = derivePaymentStatus(total, paid);
    const saleDate = dto.saleDate ? new Date(dto.saleDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const { start, end } = dayRange(saleDate);
      const seq =
        (await tx.sale.count({
          where: { saleDate: { gte: start, lt: end } },
        })) + 1;

      const sale = await tx.sale.create({
        data: {
          code: buildDailyCode('DH', saleDate, seq),
          customerId: customer.id,
          createdById: user.id,
          saleDate,
          subtotal: BigInt(subtotal),
          discount: BigInt(discount),
          totalAmount: BigInt(total),
          paidAmount: BigInt(paid),
          debtAmount: BigInt(debt),
          paymentStatus,
          note: dto.note,
          clientRequestId: dto.clientRequestId,
          items: { create: items },
        },
        include: SALE_INCLUDE,
      });

      // Sổ công nợ: bán hàng làm tăng nợ (debit = total).
      let balance = customer.currentDebt + BigInt(total);
      await tx.customerLedger.create({
        data: {
          customerId: customer.id,
          entryType: LedgerEntryType.SALE,
          refType: 'sale',
          refId: sale.id,
          debit: BigInt(total),
          balanceAfter: balance,
          createdById: user.id,
        },
      });

      // Nếu trả ngay: ghi payment + bút toán giảm nợ.
      if (paid > 0) {
        const paySeq =
          (await tx.payment.count({
            where: { paidAt: { gte: start, lt: end } },
          })) + 1;
        const payment = await tx.payment.create({
          data: {
            code: buildDailyCode('TT', saleDate, paySeq),
            customerId: customer.id,
            saleId: sale.id,
            amount: BigInt(paid),
            method: dto.paymentMethod ?? PaymentMethod.CASH,
            paidAt: saleDate,
            createdById: user.id,
            note: 'Thanh toán khi tạo đơn',
          },
        });
        balance -= BigInt(paid);
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            entryType: LedgerEntryType.PAYMENT,
            refType: 'payment',
            refId: payment.id,
            credit: BigInt(paid),
            balanceAfter: balance,
            createdById: user.id,
          },
        });
      }

      await tx.customer.update({
        where: { id: customer.id },
        data: { currentDebt: balance },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'sale.create',
          entity: 'Sale',
          entityId: sale.id,
          changes: { total, paid, debt },
        },
      });

      return sale;
    });
  }

  async findAll(q: QuerySaleDto) {
    const where: Prisma.SaleWhereInput = {};
    if (q.customerId) where.customerId = q.customerId;
    if (q.status) where.status = q.status;
    if (q.paymentStatus) where.paymentStatus = q.paymentStatus;
    if (q.from || q.to) {
      where.saleDate = {};
      if (q.from) where.saleDate.gte = new Date(q.from);
      if (q.to) where.saleDate.lte = new Date(q.to);
    }
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { customer: { name: { contains: q.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: SALE_INCLUDE,
        skip: q.skip,
        take: q.limit,
        orderBy: { saleDate: 'desc' },
      }),
      this.prisma.sale.count({ where }),
    ]);
    return paginate(data, total, q.page, q.limit);
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { ...SALE_INCLUDE, payments: true },
    });
    if (!sale) throw new NotFoundException('Không tìm thấy đơn hàng');
    return sale;
  }

  // Hủy đơn: không xóa vật lý (docs §12) — đảo phần nợ còn lại về công nợ khách.
  async cancel(id: string, user: AuthUser) {
    if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ Owner/Admin được hủy đơn');
    }
    const sale = await this.prisma.sale.findUnique({ where: { id } });
    if (!sale) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('Đơn đã được hủy trước đó');
    }

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUniqueOrThrow({
        where: { id: sale.customerId },
      });
      const balance = customer.currentDebt - sale.debtAmount;

      const cancelled = await tx.sale.update({
        where: { id },
        data: { status: SaleStatus.CANCELLED },
        include: SALE_INCLUDE,
      });

      if (sale.debtAmount > 0n) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            entryType: LedgerEntryType.CANCEL,
            refType: 'sale',
            refId: sale.id,
            credit: sale.debtAmount,
            balanceAfter: balance,
            createdById: user.id,
            note: `Hủy đơn ${sale.code}`,
          },
        });
        await tx.customer.update({
          where: { id: customer.id },
          data: { currentDebt: balance },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'sale.cancel',
          entity: 'Sale',
          entityId: sale.id,
        },
      });

      return cancelled;
    });
  }
}
