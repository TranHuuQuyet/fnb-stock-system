import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { QueryIngredientStockBoardDto } from './dto/query-ingredient-stock-board.dto';
import { SaveIngredientStockLayoutDto } from './dto/save-ingredient-stock-layout.dto';
import { IngredientStockBoardService } from './ingredient-stock-board.service';

@ApiTags('Ingredient Stock Board')
@ApiBearerAuth()
@Controller('ingredient-stock-board')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
export class IngredientStockBoardController {
  constructor(private readonly ingredientStockBoardService: IngredientStockBoardService) {}

  @Get()
  async getBoard(
    @CurrentUser() user: JwtUser,
    @Query() query: QueryIngredientStockBoardDto
  ) {
    return {
      data: await this.ingredientStockBoardService.getBoard(user, query)
    };
  }

  @Put('layout')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async saveLayout(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveIngredientStockLayoutDto
  ) {
    return {
      data: await this.ingredientStockBoardService.saveLayout(user, dto),
      message: 'Đã lưu bố cục kho nguyên liệu'
    };
  }
}
