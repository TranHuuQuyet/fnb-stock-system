import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteStoreDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  adminPassword!: string;
}
