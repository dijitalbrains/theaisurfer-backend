import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectsService } from './projects.service';
import { Project } from './entities/project.entity';

describe('ProjectsService - URL Validation Security Tests', () => {
  let service: ProjectsService;

  const mockProjectRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRedirectUrl - Security Tests', () => {
    it('should prevent open redirect with different origin', async () => {
      const mockProject = {
        slug: 'remixer',
        allowedRedirectUrls: ['http://localhost:3001/callback'],
      };

      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.validateRedirectUrl(
        'remixer',
        'http://evil.com/callback',
      );

      expect(result).toBe(false);
    });

    it('should prevent subdomain-based attacks', async () => {
      const mockProject = {
        slug: 'remixer',
        allowedRedirectUrls: ['http://example.com/callback'],
      };

      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.validateRedirectUrl(
        'remixer',
        'http://example.com/callback.evil.com',
      );

      expect(result).toBe(false);
    });

    it('should allow valid URL with same origin', async () => {
      const mockProject = {
        slug: 'remixer',
        allowedRedirectUrls: ['http://localhost:3001/callback'],
      };

      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.validateRedirectUrl(
        'remixer',
        'http://localhost:3001/callback',
      );

      expect(result).toBe(true);
    });

    it('should allow valid URL with subpath', async () => {
      const mockProject = {
        slug: 'remixer',
        allowedRedirectUrls: ['http://localhost:3001/auth'],
      };

      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.validateRedirectUrl(
        'remixer',
        'http://localhost:3001/auth/callback',
      );

      expect(result).toBe(true);
    });

    it('should reject invalid URL format', async () => {
      const mockProject = {
        slug: 'remixer',
        allowedRedirectUrls: ['http://localhost:3001/callback'],
      };

      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.validateRedirectUrl(
        'remixer',
        'not-a-url',
      );

      expect(result).toBe(false);
    });

    it('should reject when project not found', async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);

      const result = await service.validateRedirectUrl(
        'nonexistent',
        'http://localhost:3001/callback',
      );

      expect(result).toBe(false);
    });

    it('should reject when no allowed URLs configured', async () => {
      const mockProject = {
        slug: 'remixer',
        allowedRedirectUrls: [],
      };

      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.validateRedirectUrl(
        'remixer',
        'http://localhost:3001/callback',
      );

      expect(result).toBe(false);
    });
  });
});
