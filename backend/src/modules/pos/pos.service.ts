import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, ScanOperationType, ScanResultStatus, UserRole } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import {
  buildPagination,
  buildPaginationMeta,
  resolveSortField
} from '../../common/utils/pagination';
import { businessDateInTimezone } from '../../common/utils/timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { CreatePosProductDto } from './dto/create-pos-product.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { ImportPosSalesDto } from './dto/import-pos-sales.dto';
import { QueryPosProductsDto } from './dto/query-pos-products.dto';
import { ReplaceRecipeDto } from './dto/replace-recipe.dto';
import { UpdatePosProductDto } from './dto/update-pos-product.dto';

const POS_PRODUCT_SORT_FIELDS = ['createdAt', 'updatedAt', 'code', 'name', 'isActive'] as const;

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService
  ) {}

  async createProduct(actorUserId: string, dto: CreatePosProductDto) {
    const product = await this.prisma.posProduct.create({
      data: {
        code: dto.code,
        name: dto.name,
        isActive: dto.isActive ?? true
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'CREATE_POS_PRODUCT',
      entityType: 'PosProduct',
      entityId: product.id,
      newData: product
    });

    return product;
  }

  async listProducts(query: QueryPosProductsDto) {
    const { page, pageSize, skip, take } = buildPagination(query);
    const sortField = resolveSortField(query.sortBy, POS_PRODUCT_SORT_FIELDS, 'createdAt');
    const where: Prisma.PosProductWhereInput = {
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
      this.prisma.posProduct.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortField]: query.sortOrder
        }
      }),
      this.prisma.posProduct.count({ where })
    ]);

    return {
      data: items,
      pagination: buildPaginationMeta(page, pageSize, total)
    };
  }

  async updateProduct(actorUserId: string, id: string, dto: UpdatePosProductDto) {
    const existing = await this.prisma.posProduct.findUnique({ where: { id } });
    if (!existing) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.POS_IMPORT_ERROR,
        'Không tìm thấy sản phẩm POS'
      );
    }

    const updated = await this.prisma.posProduct.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'UPDATE_POS_PRODUCT',
      entityType: 'PosProduct',
      entityId: id,
      oldData: existing,
      newData: updated
    });

    return updated;
  }

  async createRecipe(actorUserId: string, dto: CreateRecipeDto) {
    const recipe = await this.prisma.recipe.create({
      data: {
        productId: dto.productId,
        ingredientId: dto.ingredientId,
        qtyPerUnit: dto.qtyPerUnit
      },
      include: {
        product: true,
        ingredient: true
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'CREATE_RECIPE',
      entityType: 'Recipe',
      entityId: recipe.id,
      newData: recipe
    });

    return recipe;
  }

  async listRecipes() {
    return this.prisma.recipe.findMany({
      include: {
        product: true,
        ingredient: true
      },
      orderBy: [{ productId: 'asc' }, { createdAt: 'asc' }]
    });
  }

  async getRecipesByProduct(productId: string) {
    const recipes = await this.prisma.recipe.findMany({
      where: { productId },
      include: {
        product: true,
        ingredient: true
      }
    });
    return recipes;
  }

  async replaceRecipe(actorUserId: string, productId: string, dto: ReplaceRecipeDto) {
    const existing = await this.getRecipesByProduct(productId);
    const replaced = await this.prisma.runInTransaction(async (tx) => {
      await tx.recipe.deleteMany({
        where: { productId }
      });
      if (dto.items.length === 0) {
        return [];
      }
      return tx.recipe.createManyAndReturn({
        data: dto.items.map((item) => ({
          productId,
          ingredientId: item.ingredientId,
          qtyPerUnit: item.qtyPerUnit
        }))
      });
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'REPLACE_RECIPE',
      entityType: 'Recipe',
      entityId: productId,
      oldData: existing,
      newData: replaced
    });

    return this.getRecipesByProduct(productId);
  }

  async importSales(actorUserId: string, dto: ImportPosSalesDto) {
    const results = [];

    for (const record of dto.records) {
      const store = await this.prisma.store.findUnique({
        where: {
          id: record.storeId
        },
        select: {
          id: true,
          isActive: true
        }
      });
      if (!store || !store.isActive) {
        throw appException(
          HttpStatus.BAD_REQUEST,
          ERROR_CODES.POS_IMPORT_ERROR,
          'Không tìm thấy cửa hàng đang hoạt động'
        );
      }

      const product = await this.prisma.posProduct.findUnique({
        where: {
          code: record.productCode
        }
      });
      if (!product) {
        throw appException(
          HttpStatus.BAD_REQUEST,
          ERROR_CODES.POS_IMPORT_ERROR,
          `Không tìm thấy mã sản phẩm ${record.productCode}`
        );
      }

      const sale = await this.prisma.posSale.upsert({
        where: {
          storeId_productId_businessDate: {
            storeId: record.storeId,
            productId: product.id,
            businessDate: new Date(record.businessDate)
          }
        },
        create: {
          storeId: record.storeId,
          productId: product.id,
          businessDate: new Date(record.businessDate),
          qtySold: record.qtySold
        },
        update: {
          qtySold: record.qtySold
        }
      });

      results.push(sale);
    }

    await this.auditService.createLog({
      actorUserId,
      action: 'IMPORT_POS_SALES',
      entityType: 'PosSale',
      entityId: `count:${results.length}`,
      newData: {
        count: results.length
      }
    });

    return results;
  }

  async getReconciliation(currentUser: JwtUser, storeId: string, businessDate: string) {
    const scopedStoreId =
      currentUser.role === UserRole.ADMIN ? storeId : currentUser.storeId ?? storeId;

    if (!scopedStoreId || (currentUser.role !== UserRole.ADMIN && scopedStoreId !== currentUser.storeId)) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Phạm vi cửa hàng không hợp lệ'
      );
    }

    const config = await this.configService.getConfig();
    const sales = await this.prisma.posSale.findMany({
      where: {
        storeId: scopedStoreId,
        businessDate: new Date(businessDate)
      },
      include: {
        product: {
          include: {
            recipes: {
              include: {
                ingredient: true
              }
            }
          }
        }
      }
    });

    const expectedMap = new Map<
      string,
      { ingredientId: string; ingredientName: string; expectedQty: number }
    >();
    for (const sale of sales) {
      for (const recipe of sale.product.recipes) {
        const key = recipe.ingredientId;
        const current = expectedMap.get(key) ?? {
          ingredientId: recipe.ingredientId,
          ingredientName: recipe.ingredient.name,
          expectedQty: 0
        };
        current.expectedQty += sale.qtySold * recipe.qtyPerUnit;
        expectedMap.set(key, current);
      }
    }

    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: scopedStoreId }
    });

    const logs = await this.prisma.scanLog.findMany({
      where: {
        storeId: scopedStoreId,
        operationType: ScanOperationType.STORE_USAGE,
        resultStatus: {
          in: [ScanResultStatus.SUCCESS, ScanResultStatus.WARNING]
        }
      },
      include: {
        batch: {
          include: {
            ingredient: true
          }
        }
      }
    });

    const actualMap = new Map<string, number>();
    for (const log of logs) {
      if (!log.batch) {
        continue;
      }
      const logBusinessDate = businessDateInTimezone(log.scannedAt, store.timezone);
      if (logBusinessDate !== businessDate) {
        continue;
      }
      actualMap.set(
        log.batch.ingredientId,
        (actualMap.get(log.batch.ingredientId) ?? 0) + log.quantityUsed
      );
    }

    const data = [...expectedMap.values()].map((item) => {
      const actualQty = actualMap.get(item.ingredientId) ?? 0;
      const ratio = item.expectedQty === 0 ? 1 : actualQty / item.expectedQty;

      return {
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        expectedQty: Number(item.expectedQty.toFixed(3)),
        actualQty: Number(actualQty.toFixed(3)),
        ratio: Number(ratio.toFixed(3)),
        belowThreshold: ratio < config.anomalyThreshold
      };
    });

    return {
      storeId: scopedStoreId,
      businessDate,
      threshold: config.anomalyThreshold,
      items: data
    };
  }
}
