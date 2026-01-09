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

    if (!project.allowedRedirectUrls || project.allowedRedirectUrls.length === 0) {
      return false;
    }

    // Check if redirectUrl matches any allowed URL
    return project.allowedRedirectUrls.some((allowedUrl) => {
      // Simple exact match or startsWith check
      return redirectUrl === allowedUrl || redirectUrl.startsWith(allowedUrl);
    });
  }

  async getUserProjects(): Promise<Project[]> {
    // Return all active projects - user has access to all projects by default
    return this.findAll();
  }
}
