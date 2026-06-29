import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class PinLoginDto {
  @ApiProperty({ example: '123456', description: '6-stellige PIN' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'PIN muss aus 6 Ziffern bestehen' })
  pin!: string;
}
