import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { Project } from './entities/project.entity';
import { UserProject } from './entities/user-project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      UserProject, // Keep entity registered for future use
    ]),
  ],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
