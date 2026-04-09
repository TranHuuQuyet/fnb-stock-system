import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  temporaryPassword?: string;
}
