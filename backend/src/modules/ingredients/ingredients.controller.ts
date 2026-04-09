import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { QueryIngredientsDto } from './dto/query-ingredients.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { IngredientsService } from './ingredients.service';

@ApiTags('Ingredients')
@ApiBearerAuth()
@Controller('admin/ingredients')
@Roles(UserRole.ADMIN)
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateIngredientDto) {
    return {
      data: await this.ingredientsService.create(user.userId, dto),
      message: 'Tạo nguyên liệu thành công'
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
