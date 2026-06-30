import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectTimesheetDto {
  @ApiProperty({ description: 'Grund für die Zurückweisung' })
  @IsString()
  @MinLength(1)
  reason!: string;
}
