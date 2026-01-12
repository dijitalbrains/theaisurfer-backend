import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SsoService } from './sso.service';
import { SsoSession } from './entities/sso-session.entity';
import { ProjectsService } from '../projects/projects.service';

describe('SsoService - Security Tests', () => {
  let service: SsoService;
  let projectsService: ProjectsService;

  const mockSsoSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockProjectsService = {
    findBySlug: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        JWT_SECRET: 'test-secret',
        JWT_ACCESS_EXPIRATION: '15m',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRATION: '7d',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoService,
        {
          provide: getRepositoryToken(SsoSession),
          useValue: mockSsoSessionRepository,
        },
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SsoService>(SsoService);
    projectsService = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateReturnUrl - Open Redirect Protection', () => {
    it('should reject URL with different origin', async () => {
      const mockProject = {
        id: 'test-id',
        slug: 'remixer',
        allowedRedirectUrls: ['http://localhost:3001/auth/callback'],
      };

      mockProjectsService.findBySlug.mockResolvedValue(mockProject);

      await expect(
        service.validateReturnUrl('remixer', 'http://evil.com/auth/callback'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject subdomain attack attempts', async () => {
      const mockProject = {
        id: 'test-id',
        slug: 'remixer',
        allowedRedirectUrls: ['http://localhost:3001/callback'],
      };

      mockProjectsService.findBySlug.mockResolvedValue(mockProject);

      await expect(
        service.validateReturnUrl('remixer', 'http://localhost:3001/callback.evil.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid URL with same origin and path', async () => {
      const mockProject = {
        id: 'test-id',
        slug: 'remixer',
        allowedRedirectUrls: ['http://localhost:3001/auth/callback'],
      };

      mockProjectsService.findBySlug.mockResolvedValue(mockProject);

      const result = await service.validateReturnUrl(
        'remixer',
        'http://localhost:3001/auth/callback',
      );

      expect(result).toBe(true);
    });

    it('should accept valid URL with same origin and subpath', async () => {
      const mockProject = {
        id: 'test-id',
        slug: 'remixer',
        allowedRedirectUrls: ['http://localhost:3001/auth'],
      };

      mockProjectsService.findBySlug.mockResolvedValue(mockProject);

      const result = await service.validateReturnUrl(
        'remixer',
        'http://localhost:3001/auth/callback',
      );

      expect(result).toBe(true);
    });

    it('should reject invalid URL format', async () => {
      const mockProject = {
        id: 'test-id',
        slug: 'remixer',
        allowedRedirectUrls: ['http://localhost:3001/callback'],
      };

      mockProjectsService.findBySlug.mockResolvedValue(mockProject);

      await expect(
        service.validateReturnUrl('remixer', 'not-a-valid-url'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when no allowed URLs configured', async () => {
      const mockProject = {
        id: 'test-id',
        slug: 'remixer',
        allowedRedirectUrls: [],
      };

      mockProjectsService.findBySlug.mockResolvedValue(mockProject);

      await expect(
        service.validateReturnUrl('remixer', 'http://localhost:3001/callback'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when project not found', async () => {
      mockProjectsService.findBySlug.mockResolvedValue(null);

      await expect(
        service.validateReturnUrl('nonexistent', 'http://localhost:3001/callback'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateProjectCredentials - API Key Validation', () => {
    it('should reject invalid API key', async () => {
      const mockProject = {
        id: 'test-id',
        slug: 'remixer',
        isActive: true,
        apiKey: 'correct-api-key',
      };

      mockProjectsService.findBySlug.mockResolvedValue(mockProject);

      await expect(
        service.validateProjectCredentials('remixer', 'wrong-api-key'),
      ).rejects.toThrow();
    });

    it('should reject when project not found', async () => {
      mockProjectsService.findBySlug.mockResolvedValue(null);

      await expect(
        service.validateProjectCredentials('nonexistent', 'any-key'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when project is inactive', async () => {
      const mockProject = {
        id: 'test-id',
        slug: 'remixer',
        isActive: false,
        apiKey: 'correct-api-key',
      };

      mockProjectsService.findBySlug.mockResolvedValue(mockProject);

      await expect(
        service.validateProjectCredentials('remixer', 'correct-api-key'),
      ).rejects.toThrow();
    });
  });
});
