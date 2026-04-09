import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { appException } from '../../common/utils/app-exception';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { QueryIngredientsDto } from './dto/query-ingredients.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

@Injectable()
export class IngredientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async create(actorUserId: string, dto: CreateIngredientDto) {
    const ingredient = await this.prisma.ingredient.create({
      data: {
        code: dto.code,
        name: dto.name,
        unit: dto.unit,
        isActive: dto.isActive ?? true
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'CREATE_INGREDIENT',
      entityType: 'Ingredient',
      entityId: ingredient.id,
      newData: ingredient
    });

    return ingredient;
  }

  async list(query: QueryIngredientsDto) {
    const { page, pageSize, skip, take } = buildPagination(query);
    const where: Prisma.IngredientWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.keyword
        ? {
            OR: [
              { code: { contains: query.keyword, mode: 'insensitive' } },
              { name: { contains: query.keyword, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingredient.findMany({
        where,
        skip,
        take,
        orderBy: {
          [query.sortBy ?? 'createdAt']: query.sortOrder
        }
      }),
      this.prisma.ingredient.count({ where })
    ]);

    return {
      data: items,
      pagination: buildPaginationMeta(page, pageSize, total)
    };
  }

  async getById(id: string) {
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_INGREDIENT_NOT_FOUND,
        'Không tìm thấy nguyên liệu'
      );
    }

    return ingredient;
  }

  async update(actorUserId: string, id: string, dto: UpdateIngredientDto) {
    const existing = await this.getById(id);
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.unit ? { unit: dto.unit } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'UPDATE_INGREDIENT',
      entityType: 'Ingredient',
      entityId: id,
      oldData: existing,
      newData: updated
    });

    return updated;
  }

  async disable(actorUserId: string, id: string) {
    const ingredient = await this.update(actorUserId, id, { isActive: false });
    await this.auditService.createLog({
      actorUserId,
      action: 'DISABLE_INGREDIENT',
      entityType: 'Ingredient',
      entityId: id,
      newData: ingredient
    });
    return ingredient;
  }
}
