import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class PinLoginDto {
  @ApiProperty({ example: '123456', description: '6-stellige PIN' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'PIN muss aus 6 Ziffern bestehen' })
  pin!: string;

  /** `kiosk` = work.vivahome.de – prüft kioskAccessEnabled; `app` = Monteur-App. */
  @ApiPropertyOptional({ enum: ['kiosk', 'app'] })
  @IsOptional()
  @IsIn(['kiosk', 'app'])
  source?: 'kiosk' | 'app';
}
