import { PartialType } from '@nestjs/swagger';
import { CreateInvoiceProductDto } from './create-invoice-product.dto';

export class UpdateInvoiceProductDto extends PartialType(
  CreateInvoiceProductDto,
) {}
