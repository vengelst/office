import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateInvoiceDto } from './create-invoice.dto';

/**
 * Bearbeitung einer Rechnung (nur im Status DRAFT erlaubt).
 * Rechnungstyp und Positionen werden über eigene Endpoints verwaltet.
 */
export class UpdateInvoiceDto extends PartialType(
  OmitType(CreateInvoiceDto, ['invoiceType', 'lines'] as const),
) {}
