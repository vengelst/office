import { PartialType } from '@nestjs/swagger';
import { CreateEmailRecipientDto } from './create-email-recipient.dto';

export class UpdateEmailRecipientDto extends PartialType(
  CreateEmailRecipientDto,
) {}
