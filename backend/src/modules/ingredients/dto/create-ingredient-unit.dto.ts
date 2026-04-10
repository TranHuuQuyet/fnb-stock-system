import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateIngredientUnitDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;
}
