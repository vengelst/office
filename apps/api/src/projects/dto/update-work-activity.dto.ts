import { PartialType } from '@nestjs/swagger';
import { CreateProjectWorkActivityDto } from './create-work-activity.dto';

export class UpdateProjectWorkActivityDto extends PartialType(
  CreateProjectWorkActivityDto,
) {}
