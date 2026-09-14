import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { UpdatePriceListDto } from './dto/update-price-list.dto';
import { UpsertPriceListItemsDto } from './dto/upsert-price-list-items.dto';
import { PriceListsService } from './price-lists.service';

@ApiTags('price-lists')
@ApiBearerAuth()
@Controller('price-lists')
export class PriceListsController {
  constructor(private readonly service: PriceListsService) {}

  @Get()
  findAll(@Query() q: PaginationQueryDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/price/:productId')
  getPrice(@Param('id') id: string, @Param('productId') productId: string) {
    return this.service.getPrice(id, productId);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  create(@Body() dto: CreatePriceListDto) {
    return this.service.create(dto);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePriceListDto) {
    return this.service.update(id, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Put(':id/items')
  upsertItems(@Param('id') id: string, @Body() dto: UpsertPriceListItemsDto) {
    return this.service.upsertItems(id, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id/items/:productId')
  removeItem(@Param('id') id: string, @Param('productId') productId: string) {
    return this.service.removeItem(id, productId);
  }
}
