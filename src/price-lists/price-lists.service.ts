import { Injectable, NotFoundException } from '@nestjs/common';
import { RecordStatus } from '@prisma/client';
import { PaginationQueryDto, paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { UpdatePriceListDto } from './dto/update-price-list.dto';
import { UpsertPriceListItemsDto } from './dto/upsert-price-list-items.dto';

@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: PaginationQueryDto) {
    const where = q.search
      ? { name: { contains: q.search, mode: 'insensitive' as const } }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.priceList.findMany({
        where,
        skip: q.skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.priceList.count({ where }),
    ]);
    return paginate(data, total, q.page, q.limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.priceList.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Không tìm thấy bảng giá');
    return row;
  }

  create(dto: CreatePriceListDto) {
    return this.prisma.priceList.create({
      data: {
        name: dto.name,
        isActive: dto.isActive,
        effectiveFrom: dto.effectiveFrom
          ? new Date(dto.effectiveFrom)
          : undefined,
      },
    });
  }

  async update(id: string, dto: UpdatePriceListDto) {
    await this.ensureExists(id);
    return this.prisma.priceList.update({
      where: { id },
      data: {
        name: dto.name,
        isActive: dto.isActive,
        effectiveFrom: dto.effectiveFrom
          ? new Date(dto.effectiveFrom)
          : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.priceList.update({
      where: { id },
      data: { status: RecordStatus.INACTIVE },
    });
  }

  async upsertItems(id: string, dto: UpsertPriceListItemsDto) {
    await this.ensureExists(id);
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.priceListItem.upsert({
          where: {
            priceListId_productId: {
              priceListId: id,
              productId: item.productId,
            },
          },
          create: {
            priceListId: id,
            productId: item.productId,
            price: BigInt(item.price),
          },
          update: { price: BigInt(item.price) },
        }),
      ),
    );
    return this.findOne(id);
  }

  async removeItem(id: string, productId: string) {
    await this.ensureExists(id);
    await this.prisma.priceListItem.deleteMany({
      where: { priceListId: id, productId },
    });
    return { success: true };
  }

  async getPrice(id: string, productId: string) {
    await this.ensureExists(id);
    const item = await this.prisma.priceListItem.findUnique({
      where: {
        priceListId_productId: { priceListId: id, productId },
      },
      include: {
        product: { select: { id: true, name: true, unit: true } },
      },
    });
    if (!item)
      throw new NotFoundException('Không tìm thấy giá cho sản phẩm này');
    return item;
  }

  private async ensureExists(id: string) {
    const row = await this.prisma.priceList.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Không tìm thấy bảng giá');
  }
}
