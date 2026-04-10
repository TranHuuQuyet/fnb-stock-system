import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateIngredientUnitDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;
}
