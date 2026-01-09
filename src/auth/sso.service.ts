import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ProjectsService } from '../projects/projects.service';
import { User } from '../users/entities/user.entity';
import { SsoResponseDto, SsoUserDto, SsoSessionDto } from './dto/sso-response.dto';
import * as crypto from 'crypto';

interface SsoSession {
  projectSlug: string;
  projectName: string;
  returnUrl: string;
  state?: string;
  createdAt: Date;
}

@Injectable()
export class SsoService {
  // In-memory session store (in production, use Redis or database)
  private ssoSessions: Map<string, SsoSession> = new Map();

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Clean up expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

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

    if (!project.allowedRedirectUrls || project.allowedRedirectUrls.length === 0) {
      throw new BadRequestException(
        `Project '${projectSlug}' has no allowed redirect URLs configured`,
      );
    }

    const isAllowed = project.allowedRedirectUrls.some((allowedUrl) => {
      return returnUrl === allowedUrl || returnUrl.startsWith(allowedUrl);
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

    // Generate secure random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    const session: SsoSession = {
      projectSlug: project.slug,
      projectName: project.name,
      returnUrl,
      state,
      createdAt: new Date(),
    };

    this.ssoSessions.set(sessionId, session);

    return sessionId;
  }

  /**
   * Get SSO session data
   */
  getSSOSession(sessionId: string): SsoSessionDto | null {
    const session = this.ssoSessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session is expired (15 minutes)
    const expirationTime = 15 * 60 * 1000;
    if (Date.now() - session.createdAt.getTime() > expirationTime) {
      this.ssoSessions.delete(sessionId);
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
    const session = this.getSSOSession(sessionId);

    if (!session) {
      throw new BadRequestException('Invalid or expired SSO session');
    }

    // Generate JWT tokens
    const payload = {
      sub: user.id,
      email: user.email,
      projectSlug: session.projectSlug,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION') || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
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

    // Build redirect URL with tokens
    const redirectUrl = new URL(session.returnUrl);
    redirectUrl.searchParams.set('token', accessToken);
    redirectUrl.searchParams.set('refresh', refreshToken);
    redirectUrl.searchParams.set('user', JSON.stringify(userDto));
    if (session.state) {
      redirectUrl.searchParams.set('state', session.state);
    }

    // Delete session after use
    this.ssoSessions.delete(sessionId);

    return {
      redirectUrl: redirectUrl.toString(),
      tokens,
    };
  }

  /**
   * Clean up expired SSO sessions
   */
  private cleanupExpiredSessions(): void {
    const expirationTime = 15 * 60 * 1000; // 15 minutes
    const now = Date.now();

    for (const [sessionId, session] of this.ssoSessions.entries()) {
      if (now - session.createdAt.getTime() > expirationTime) {
        this.ssoSessions.delete(sessionId);
      }
    }
  }
}
