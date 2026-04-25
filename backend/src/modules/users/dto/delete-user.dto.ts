import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  adminPassword!: string;
}
