import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectResourcesService } from './project-resources.service';
import { ProjectAssignmentsService } from './project-assignments.service';

@Module({
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectResourcesService,
    ProjectAssignmentsService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
