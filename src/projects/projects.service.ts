import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async create(projectData: {
    name: string;
    slug: string;
    allowedRedirectUrls?: string[];
  }): Promise<Project> {
    const existingProject = await this.findBySlug(projectData.slug);
    if (existingProject) {
      throw new ConflictException('Project slug already exists');
    }

    const project = this.projectRepository.create(projectData);
    return this.projectRepository.save(project);
  }

  async findAll(): Promise<Project[]> {
    return this.projectRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllProjects(): Promise<Project[]> {
    return this.projectRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findBySlug(slug: string): Promise<Project | null> {
    return this.projectRepository.findOne({ where: { slug } });
  }

  async findById(id: string): Promise<Project | null> {
    return this.projectRepository.findOne({ where: { id } });
  }

  async update(
    slug: string,
    updateData: {
      name?: string;
      isActive?: boolean;
      allowedRedirectUrls?: string[];
    },
  ): Promise<Project> {
    const project = await this.findBySlug(slug);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    Object.assign(project, updateData);
    return this.projectRepository.save(project);
  }

  async validateRedirectUrl(
    projectSlug: string,
    redirectUrl: string,
  ): Promise<boolean> {
    const project = await this.findBySlug(projectSlug);
    if (!project) {
      return false;
    }

    if (
      !project.allowedRedirectUrls ||
      project.allowedRedirectUrls.length === 0
    ) {
      return false;
    }

    try {
      const redirectUrlObj = new URL(redirectUrl);

      return project.allowedRedirectUrls.some((allowedUrl) => {
        try {
          const allowedUrlObj = new URL(allowedUrl);

          if (redirectUrlObj.origin !== allowedUrlObj.origin) {
            return false;
          }

          if (allowedUrlObj.pathname === '/' || allowedUrlObj.pathname === '') {
            return true;
          }

          return (
            redirectUrlObj.pathname === allowedUrlObj.pathname ||
            redirectUrlObj.pathname.startsWith(allowedUrlObj.pathname)
          );
        } catch {
          return redirectUrl === allowedUrl;
        }
      });
    } catch {
      return false;
    }
  }

  async getUserProjects(): Promise<Project[]> {
    return this.findAll();
  }
}
