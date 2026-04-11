import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireBusinessNetwork } from '../../common/decorators/require-business-network.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { CreatePosProductDto } from './dto/create-pos-product.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { ImportPosSalesDto } from './dto/import-pos-sales.dto';
import { QueryPosProductsDto } from './dto/query-pos-products.dto';
import { ReplaceRecipeDto } from './dto/replace-recipe.dto';
import { UpdatePosProductDto } from './dto/update-pos-product.dto';
import { PosService } from './pos.service';

@ApiTags('POS')
@ApiBearerAuth()
@Controller()
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('admin/pos-products')
  @Roles(UserRole.ADMIN)
  async createProduct(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePosProductDto
  ) {
    return {
      data: await this.posService.createProduct(user.userId, dto),
      message: 'Tạo sản phẩm POS thành công'
    };
  }

  @Get('admin/pos-products')
  @Roles(UserRole.ADMIN)
  async listProducts(@Query() query: QueryPosProductsDto) {
    return this.posService.listProducts(query);
  }

  @Patch('admin/pos-products/:id')
  @Roles(UserRole.ADMIN)
  async updateProduct(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdatePosProductDto
  ) {
    return {
      data: await this.posService.updateProduct(user.userId, id, dto),
      message: 'Cập nhật sản phẩm POS thành công'
    };
  }

  @Post('admin/recipes')
  @Roles(UserRole.ADMIN)
  async createRecipe(@CurrentUser() user: JwtUser, @Body() dto: CreateRecipeDto) {
    return {
      data: await this.posService.createRecipe(user.userId, dto),
      message: 'Tạo công thức thành công'
    };
  }

  @Get('admin/recipes')
  @Roles(UserRole.ADMIN)
  async listRecipes() {
    return {
      data: await this.posService.listRecipes()
    };
  }

  @Get('admin/recipes/:productId')
  @Roles(UserRole.ADMIN)
  async getRecipesByProduct(@Param('productId') productId: string) {
    return {
      data: await this.posService.getRecipesByProduct(productId)
    };
  }

  @Put('admin/recipes/:productId')
  @Roles(UserRole.ADMIN)
  async replaceRecipe(
    @CurrentUser() user: JwtUser,
    @Param('productId') productId: string,
    @Body() dto: ReplaceRecipeDto
  ) {
    return {
      data: await this.posService.replaceRecipe(user.userId, productId, dto),
      message: 'Cập nhật công thức thành công'
    };
  }

  @Post('pos/sales/import')
  @Roles(UserRole.ADMIN)
  async importSales(@CurrentUser() user: JwtUser, @Body() dto: ImportPosSalesDto) {
    return {
      data: await this.posService.importSales(user.userId, dto),
      message: 'Nhập dữ liệu bán POS thành công'
    };
  }

  @Get('pos/reconciliation')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @RequireBusinessNetwork()
  async reconciliation(
    @CurrentUser() user: JwtUser,
    @Query('storeId') storeId: string,
    @Query('businessDate') businessDate: string
  ) {
    return {
      data: await this.posService.getReconciliation(user, storeId, businessDate)
    };
  }
}
