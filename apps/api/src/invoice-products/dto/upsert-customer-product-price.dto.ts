import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class UpsertCustomerProductPriceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  productId!: string;

  @ApiProperty({ description: 'Kundenpreis (Netto je Einheit)' })
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}
