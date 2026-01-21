import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all active projects',
    description:
      'Returns a list of all active projects available in the system',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active projects retrieved successfully',
    type: [ProjectResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async findAll() {
    return this.projectsService.findAll();
  }

  @Get('my-projects')
  @ApiOperation({
    summary: 'Get user projects',
    description:
      'Returns all active projects. By default, all users have access to all projects.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of accessible projects retrieved successfully',
    type: [ProjectResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async getMyProjects() {
    return this.projectsService.getUserProjects();
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get project by slug',
    description:
      'Retrieve detailed information about a specific project using its slug',
  })
  @ApiParam({
    name: 'slug',
    description: 'Project slug identifier',
    example: 'remixer',
  })
  @ApiResponse({
    status: 200,
    description: 'Project details retrieved successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found with the provided slug',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async findBySlug(@Param('slug') slug: string) {
    const project = await this.projectsService.findBySlug(slug);
    if (!project) {
      throw new NotFoundException(`Project with slug '${slug}' not found`);
    }
    return project;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new project',
    description:
      'Admin endpoint to create a new project with name, slug, and optional redirect URLs',
  })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - A project with this slug already exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Patch(':slug')
  @ApiOperation({
    summary: 'Update project details',
    description:
      'Admin endpoint to update project information such as name, status, or redirect URLs',
  })
  @ApiParam({
    name: 'slug',
    description: 'Project slug identifier',
    example: 'remixer',
  })
  @ApiResponse({
    status: 200,
    description: 'Project updated successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found with the provided slug',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async update(
    @Param('slug') slug: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(slug, updateProjectDto);
  }
}
