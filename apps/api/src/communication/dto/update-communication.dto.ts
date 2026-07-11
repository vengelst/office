import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCommunicationDto } from './create-communication.dto';

export class UpdateCommunicationDto extends PartialType(
  OmitType(CreateCommunicationDto, ['entityType', 'entityId'] as const),
) {}
