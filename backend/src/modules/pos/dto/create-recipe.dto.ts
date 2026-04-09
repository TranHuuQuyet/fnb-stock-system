import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateRecipeDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsString()
  ingredientId!: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  qtyPerUnit!: number;
}
