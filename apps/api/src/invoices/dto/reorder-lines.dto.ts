import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderLinesDto {
  @ApiProperty({
    type: [String],
    description: 'Positions-IDs in der gewünschten neuen Reihenfolge',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  lineIds!: string[];
}
