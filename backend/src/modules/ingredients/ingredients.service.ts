import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { appException } from '../../common/utils/app-exception';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { CreateIngredientUnitDto } from './dto/create-ingredient-unit.dto';
import { QueryIngredientsDto } from './dto/query-ingredients.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { UpdateIngredientUnitDto } from './dto/update-ingredient-unit.dto';

type IngredientUnitView = {
  id: string;
  name: string;
  usageCount: number;
};

@Injectable()
export class IngredientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async create(actorUserId: string, dto: CreateIngredientDto) {
    const unit = await this.ensureUnitExists(dto.unit);
    const ingredient = await this.prisma.ingredient.create({
      data: {
        code: dto.code,
        name: dto.name,
        unit: unit.name,
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

  async listUnits(): Promise<IngredientUnitView[]> {
    const [units, ingredients] = await this.prisma.$transaction([
      this.prisma.ingredientUnit.findMany({
        orderBy: {
          name: 'asc'
        }
      }),
      this.prisma.ingredient.findMany({
        select: {
          unit: true
        }
      })
    ]);

    const usageMap = new Map<string, number>();
    for (const ingredient of ingredients) {
      usageMap.set(ingredient.unit, (usageMap.get(ingredient.unit) ?? 0) + 1);
    }

    return units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      usageCount: usageMap.get(unit.name) ?? 0
    }));
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
    const unit = dto.unit ? await this.ensureUnitExists(dto.unit) : null;
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(unit ? { unit: unit.name } : {}),
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

  async createUnit(actorUserId: string, dto: CreateIngredientUnitDto): Promise<IngredientUnitView> {
    const name = this.requireUnitName(dto.name);
    const normalizedName = this.normalizeUnitName(dto.name);

    if (!name) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Đơn vị không được để trống'
      );
    }

    const existing = await this.prisma.ingredientUnit.findUnique({
      where: { normalizedName }
    });
    if (existing) {
      return this.toUnitView(existing.id, existing.name);
    }

    const unit = await this.prisma.ingredientUnit.create({
      data: {
        name,
        normalizedName
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'CREATE_INGREDIENT_UNIT',
      entityType: 'IngredientUnit',
      entityId: unit.id,
      newData: unit
    });

    return {
      id: unit.id,
      name: unit.name,
      usageCount: 0
    };
  }

  async updateUnit(
    actorUserId: string,
    id: string,
    dto: UpdateIngredientUnitDto
  ): Promise<IngredientUnitView> {
    const existing = await this.getUnitById(id);
    const name = this.requireUnitName(dto.name);
    const normalizedName = this.normalizeUnitName(dto.name);
    const duplicate = await this.prisma.ingredientUnit.findUnique({
      where: { normalizedName }
    });

    if (duplicate && duplicate.id !== id) {
      const merged = await this.prisma.$transaction(async (tx) => {
        const target = await tx.ingredientUnit.update({
          where: { id: duplicate.id },
          data: {
            name,
            normalizedName
          }
        });

        await tx.ingredient.updateMany({
          where: {
            OR: [{ unit: existing.name }, { unit: duplicate.name }]
          },
          data: {
            unit: name
          }
        });

        await tx.ingredientUnit.delete({
          where: { id: existing.id }
        });

        return target;
      });

      const view = await this.toUnitView(merged.id, merged.name);
      await this.auditService.createLog({
        actorUserId,
        action: 'UPDATE_INGREDIENT_UNIT',
        entityType: 'IngredientUnit',
        entityId: existing.id,
        oldData: existing,
        newData: {
          ...view,
          mergedIntoId: merged.id
        }
      });

      return view;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const unit = await tx.ingredientUnit.update({
        where: { id },
        data: {
          name,
          normalizedName
        }
      });

      if (existing.name !== name) {
        await tx.ingredient.updateMany({
          where: {
            unit: existing.name
          },
          data: {
            unit: name
          }
        });
      }

      return unit;
    });

    const view = await this.toUnitView(updated.id, updated.name);
    await this.auditService.createLog({
      actorUserId,
      action: 'UPDATE_INGREDIENT_UNIT',
      entityType: 'IngredientUnit',
      entityId: updated.id,
      oldData: existing,
      newData: view
    });

    return view;
  }

  async deleteUnit(actorUserId: string, id: string): Promise<IngredientUnitView> {
    const existing = await this.getUnitById(id);
    const usageCount = await this.getUnitUsageCount(existing.name);

    if (usageCount > 0) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        `Không thể xóa đơn vị đang được sử dụng bởi ${usageCount} nguyên liệu`
      );
    }

    await this.prisma.ingredientUnit.delete({
      where: { id }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'DELETE_INGREDIENT_UNIT',
      entityType: 'IngredientUnit',
      entityId: existing.id,
      oldData: {
        ...existing,
        usageCount
      }
    });

    return {
      id: existing.id,
      name: existing.name,
      usageCount
    };
  }

  private async ensureUnitExists(unitName: string) {
    const name = this.requireUnitName(unitName);
    const normalizedName = this.normalizeUnitName(unitName);

    if (!name) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Đơn vị không được để trống'
      );
    }

    return this.prisma.ingredientUnit.upsert({
      where: { normalizedName },
      update: {},
      create: {
        name,
        normalizedName
      }
    });
  }

  private async getUnitById(id: string) {
    const unit = await this.prisma.ingredientUnit.findUnique({
      where: { id }
    });

    if (!unit) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_INGREDIENT_UNIT_NOT_FOUND,
        'Không tìm thấy đơn vị'
      );
    }

    return unit;
  }

  private async toUnitView(id: string, name: string): Promise<IngredientUnitView> {
    return {
      id,
      name,
      usageCount: await this.getUnitUsageCount(name)
    };
  }

  private async getUnitUsageCount(name: string) {
    return this.prisma.ingredient.count({
      where: {
        unit: name
      }
    });
  }

  private requireUnitName(value: string) {
    const name = this.formatUnitName(value);

    if (!name) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Đơn vị không được để trống'
      );
    }

    return name;
  }

  private formatUnitName(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeUnitName(value: string) {
    return this.formatUnitName(value).toLowerCase();
  }
}
