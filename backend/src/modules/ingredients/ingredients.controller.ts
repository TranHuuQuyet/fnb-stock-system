import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { CreateIngredientUnitDto } from './dto/create-ingredient-unit.dto';
import { QueryIngredientsDto } from './dto/query-ingredients.dto';
import { UpdateIngredientUnitDto } from './dto/update-ingredient-unit.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { IngredientsService } from './ingredients.service';

@ApiTags('Ingredients')
@ApiBearerAuth()
@Controller('admin/ingredients')
@Roles(UserRole.ADMIN)
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post('units')
  async createUnit(@CurrentUser() user: JwtUser, @Body() dto: CreateIngredientUnitDto) {
    return {
      data: await this.ingredientsService.createUnit(user.userId, dto),
      message: 'Tạo đơn vị thành công'
    };
  }

  @Patch('units/:id')
  async updateUnit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateIngredientUnitDto
  ) {
    return {
      data: await this.ingredientsService.updateUnit(user.userId, id, dto),
      message: 'Cập nhật đơn vị thành công'
    };
  }

  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateIngredientDto) {
    return {
      data: await this.ingredientsService.create(user.userId, dto),
      message: 'Tạo nguyên liệu thành công'
    };
  }

  @Get('units')
  async listUnits() {
    return {
      data: await this.ingredientsService.listUnits()
    };
  }

  @Delete('units/:id')
  async deleteUnit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return {
      data: await this.ingredientsService.deleteUnit(user.userId, id),
      message: 'Xóa đơn vị thành công'
    };
  }

  @Get()
  async list(@Query() query: QueryIngredientsDto) {
    return this.ingredientsService.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return {
      data: await this.ingredientsService.getById(id)
    };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto
  ) {
    return {
      data: await this.ingredientsService.update(user.userId, id, dto),
      message: 'Cập nhật nguyên liệu thành công'
    };
  }

  @Delete(':id')
  async disable(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return {
      data: await this.ingredientsService.disable(user.userId, id),
      message: 'Vô hiệu hóa nguyên liệu thành công'
    };
  }
}
