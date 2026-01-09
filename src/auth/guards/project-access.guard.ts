import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ProjectsService } from '../../projects/projects.service';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly projectsService: ProjectsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Get project slug from request params, query, or body
    const projectSlug =
      request.params?.projectSlug ||
      request.query?.projectSlug ||
      request.body?.projectSlug ||
      user.projectSlug; // From JWT token

    if (!projectSlug) {
      throw new UnauthorizedException('Project not specified');
    }

    // Verify project exists and is active
    // All users have access to all projects by default
    const project = await this.projectsService.findBySlug(projectSlug);
    
    if (!project) {
      throw new UnauthorizedException('Project not found');
    }

    if (!project.isActive) {
      throw new UnauthorizedException('Project is not active');
    }

    return true;
  }
}
