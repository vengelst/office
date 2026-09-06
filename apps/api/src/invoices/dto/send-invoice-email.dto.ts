import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class SendInvoiceEmailDto {
  @ApiPropertyOptional({
    description: 'Document-IDs aus Kundendokumenten (keine Blind-Uploads)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentIds?: string[];

  @ApiPropertyOptional({
    description:
      'WeeklyTimesheet-IDs, die an der Rechnung hängen – PDF wird bei Versand erzeugt',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  weeklyTimesheetIds?: string[];
}
