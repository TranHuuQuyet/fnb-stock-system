import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsPositive,
  IsString,
  ValidateNested
} from 'class-validator';

class PosSaleItemDto {
  @ApiProperty()
  @IsString()
  storeId!: string;

  @ApiProperty()
  @IsString()
  productCode!: string;

  @ApiProperty()
  @IsDateString()
  businessDate!: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  qtySold!: number;
}

export class ImportPosSalesDto {
  @ApiProperty({ type: [PosSaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  records!: PosSaleItemDto[];
}

export { PosSaleItemDto };
