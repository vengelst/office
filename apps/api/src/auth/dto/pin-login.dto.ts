import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * PIN-Login: Länge 4–8 (exakte Länge wird serverseitig gegen AppSetting geprüft).
 */
export class PinLoginDto {
  @ApiProperty({
    example: '123456',
    description: 'Numerische PIN (Länge laut Einstellungen, 4–8 Ziffern)',
  })
  @IsString()
  @Length(4, 8)
  @Matches(/^\d{4,8}$/, {
    message: 'PIN muss aus 4 bis 8 Ziffern bestehen',
  })
  pin!: string;

  /** `kiosk` = work.vivahome.de – prüft kioskAccessEnabled; `app` = Monteur-App. */
  @ApiPropertyOptional({ enum: ['kiosk', 'app'] })
  @IsOptional()
  @IsIn(['kiosk', 'app'])
  source?: 'kiosk' | 'app';
}
