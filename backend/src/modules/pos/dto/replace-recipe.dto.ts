import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsPositive, IsString, ValidateNested } from 'class-validator';

class RecipeItemDto {
  @ApiProperty()
  @IsString()
  ingredientId!: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  qtyPerUnit!: number;
}

export class ReplaceRecipeDto {
  @ApiProperty({ type: [RecipeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  items!: RecipeItemDto[];
}

export { RecipeItemDto };
