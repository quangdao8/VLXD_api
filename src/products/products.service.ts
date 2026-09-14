import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const categorySelect = { select: { id: true, name: true } } as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: QueryProductDto) {
    const where: Prisma.ProductWhereInput = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.categoryId) where.categoryId = q.categoryId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: categorySelect },
        skip: q.skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(data, total, q.page, q.limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: { category: categorySelect },
    });
    if (!row) throw new NotFoundException('Không tìm thấy sản phẩm');
    return row;
  }

  async create(dto: CreateProductDto) {
    const code =
      dto.code ?? `SP${String((await this.prisma.product.count()) + 1).padStart(4, '0')}`;
    return this.prisma.product.create({
      data: {
        code,
        name: dto.name,
        unit: dto.unit,
        categoryId: dto.categoryId ?? null,
        description: dto.description ?? null,
        defaultPrice: BigInt(dto.defaultPrice),
        costPrice: dto.costPrice != null ? BigInt(dto.costPrice) : null,
      },
      include: { category: categorySelect },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    const data: Prisma.ProductUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }
    if (dto.defaultPrice !== undefined)
      data.defaultPrice = BigInt(dto.defaultPrice);
    if (dto.costPrice !== undefined)
      data.costPrice = dto.costPrice != null ? BigInt(dto.costPrice) : null;

    return this.prisma.product.update({
      where: { id },
      data,
      include: { category: categorySelect },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { status: RecordStatus.INACTIVE },
    });
  }
}
