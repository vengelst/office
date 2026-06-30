import { PartialType } from '@nestjs/swagger';
import { CreateInvoiceLineDto } from './create-invoice-line.dto';

export class UpdateInvoiceLineDto extends PartialType(CreateInvoiceLineDto) {}
