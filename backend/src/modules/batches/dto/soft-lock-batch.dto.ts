import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SoftLockBatchDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
