import { PartialType } from '@nestjs/swagger';
import { CreateSubcontractorContactDto } from './create-subcontractor-contact.dto';

export class UpdateSubcontractorContactDto extends PartialType(
  CreateSubcontractorContactDto,
) {}
