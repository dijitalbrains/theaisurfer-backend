import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProjectsService } from '../projects/projects.service';
import { User } from '../users/entities/user.entity';
import { SsoSession } from './entities/sso-session.entity';
import {
  SsoResponseDto,
  SsoUserDto,
  SsoSessionDto,
} from './dto/sso-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class SsoService {
  constructor(
    @InjectRepository(SsoSession)
    private readonly ssoSessionRepository: Repository<SsoSession>,
    private readonly projectsService: ProjectsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validate project credentials (slug + API key)
   */
  async validateProjectCredentials(
    projectSlug: string,
    apiKey: string,
  ): Promise<boolean> {
    const project = await this.projectsService.findBySlug(projectSlug);

    if (!project) {
      throw new NotFoundException(`Project '${projectSlug}' not found`);
    }

    if (!project.isActive) {
      throw new UnauthorizedException(`Project '${projectSlug}' is not active`);
    }

    if (!project.apiKey) {
      throw new UnauthorizedException(
        `Project '${projectSlug}' does not have SSO enabled`,
      );
    }

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(project.apiKey),
      Buffer.from(apiKey),
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  /**
   * Validate return URL against project's allowed redirect URLs
   */
  async validateReturnUrl(
    projectSlug: string,
    returnUrl: string,
  ): Promise<boolean> {
    const project = await this.projectsService.findBySlug(projectSlug);

    if (!project) {
      throw new NotFoundException(`Project '${projectSlug}' not found`);
    }

    if (
      !project.allowedRedirectUrls ||
      project.allowedRedirectUrls.length === 0
    ) {
      throw new BadRequestException(
        `Project '${projectSlug}' has no allowed redirect URLs configured`,
      );
    }

    let returnUrlObj: URL;
    try {
      returnUrlObj = new URL(returnUrl);
    } catch {
      throw new BadRequestException('Invalid return URL format');
    }

    const isAllowed = project.allowedRedirectUrls.some((allowedUrl) => {
      try {
        const allowedUrlObj = new URL(allowedUrl);

        if (returnUrlObj.origin !== allowedUrlObj.origin) {
          return false;
        }

        if (allowedUrlObj.pathname === '/' || allowedUrlObj.pathname === '') {
          return true;
        }

        return (
          returnUrlObj.pathname === allowedUrlObj.pathname ||
          returnUrlObj.pathname.startsWith(allowedUrlObj.pathname)
        );
      } catch {
        return returnUrl === allowedUrl;
      }
    });

    if (!isAllowed) {
      throw new BadRequestException(
        `Return URL '${returnUrl}' is not whitelisted for project '${projectSlug}'`,
      );
    }

    return true;
  }

  /**
   * Generate SSO session for the authentication flow
   */
  async generateSSOSession(
    projectSlug: string,
    returnUrl: string,
    state?: string,
  ): Promise<string> {
    const project = await this.projectsService.findBySlug(projectSlug);

    if (!project) {
      throw new NotFoundException(`Project '${projectSlug}' not found`);
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const session = this.ssoSessionRepository.create({
      id: sessionId,
      projectId: project.id,
      projectSlug: project.slug,
      projectName: project.name,
      returnUrl,
      state,
      expiresAt,
      isConsumed: false,
    });

    await this.ssoSessionRepository.save(session);

    return sessionId;
  }

  /**
   * Get SSO session data
   */
  async getSSOSession(sessionId: string): Promise<SsoSessionDto | null> {
    const session = await this.ssoSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      console.log('[SSO] Session not found:', sessionId);
      return null;
    }

    if (session.expiresAt < new Date()) {
      console.log('[SSO] Session expired:', sessionId);
      return null;
    }

    if (session.isConsumed) {
      console.log('[SSO] Session already consumed:', sessionId);
      return null;
    }

    return {
      projectSlug: session.projectSlug,
      projectName: session.projectName,
      returnUrl: session.returnUrl,
      state: session.state,
    };
  }

  /**
   * Complete SSO authentication and generate tokens
   */
  async completeSSOAuth(
    user: User,
    sessionId: string,
  ): Promise<{ redirectUrl: string; tokens: SsoResponseDto }> {
    const session = await this.getSSOSession(sessionId);

    if (!session) {
      throw new BadRequestException('Invalid or expired SSO session');
    }

    await this.ssoSessionRepository.update(sessionId, { isConsumed: true });

    // Generate JWT tokens with audience claim
    const payload = {
      sub: user.id,
      email: user.email,
      projectSlug: session.projectSlug,
      aud: session.projectSlug,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION') || '15m',
    });

    const refreshPayload = {
      sub: user.id,
      email: user.email,
      projectSlug: session.projectSlug,
      aud: session.projectSlug,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION') || '7d',
    });

    const userDto: SsoUserDto = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const tokens: SsoResponseDto = {
      accessToken,
      refreshToken,
      user: userDto,
      state: session.state,
    };

    return {
      redirectUrl: session.returnUrl,
      tokens,
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredSessions(): Promise<void> {
    await this.ssoSessionRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    await this.ssoSessionRepository.delete({
      isConsumed: true,
      createdAt: LessThan(oneHourAgo),
    });
  }
}
