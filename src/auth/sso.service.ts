import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProjectsService } from '../projects/projects.service';
import { User } from '../users/entities/user.entity';
import { SsoSession } from './entities/sso-session.entity';
import { AuthorizationCode } from './entities/authorization-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { SsoSessionDto } from './dto/sso-response.dto';
import { AuthorizationCodeResponseDto, TokenResponseDto } from './dto/pkce.dto';
import { PkceService } from './pkce.service';
import { AuditService } from './audit.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import type { QueryRunner } from 'typeorm';
import type { StringValue } from 'ms';

@Injectable()
export class SsoService {
  constructor(
    @InjectRepository(SsoSession)
    private readonly ssoSessionRepository: Repository<SsoSession>,
    @InjectRepository(AuthorizationCode)
    private readonly authCodeRepository: Repository<AuthorizationCode>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly projectsService: ProjectsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly pkceService: PkceService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async validateProjectCredentials(
    projectSlug: string,
    apiKey: string,
    ipAddress?: string,
    userAgent?: string,
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

    const isValid = crypto.timingSafeEqual(
      Buffer.from(project.apiKey),
      Buffer.from(apiKey),
    );

    if (!isValid) {
      await this.auditService.logInvalidApiKey(
        project.id,
        ipAddress,
        userAgent,
      );
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  async validateReturnUrl(
    projectSlug: string,
    returnUrl: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string,
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
          return returnUrlObj.pathname.startsWith('/');
        }

        return returnUrlObj.pathname === allowedUrlObj.pathname;
      } catch {
        return returnUrl === allowedUrl;
      }
    });

    if (!isAllowed) {
      await this.auditService.logInvalidRedirectUrl(
        project.id,
        sessionId || '',
        {
          attemptedUrl: returnUrl,
          allowedUrls: project.allowedRedirectUrls,
        },
        ipAddress,
        userAgent,
      );
      throw new BadRequestException(
        `Return URL '${returnUrl}' is not whitelisted for project '${projectSlug}'`,
      );
    }

    return true;
  }

  async generateSSOSession(
    projectSlug: string,
    returnUrl: string,
    state: string,
    codeChallenge: string,
    codeChallengeMethod: string,
    ipAddress?: string,
    userAgent?: string,
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
      codeChallenge,
      codeChallengeMethod,
      expiresAt,
      isConsumed: false,
      ipAddress,
      userAgent,
    });

    await this.ssoSessionRepository.save(session);

    await this.auditService.logSsoInitiated(
      project.id,
      sessionId,
      ipAddress,
      userAgent,
    );

    return sessionId;
  }

  async getSSOSession(sessionId: string): Promise<SsoSessionDto | null> {
    const session = await this.ssoSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      return null;
    }

    if (session.isConsumed) {
      return null;
    }

    return {
      projectSlug: session.projectSlug,
      projectName: session.projectName,
      returnUrl: session.returnUrl,
      state: session.state,
    };
  }

  async authorizeSession(
    user: User,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthorizationCodeResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const session = await queryRunner.manager.findOne(SsoSession, {
        where: { id: sessionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!session) {
        throw new BadRequestException('Invalid or expired SSO session');
      }

      if (session.expiresAt < new Date()) {
        throw new BadRequestException('SSO session expired');
      }

      if (session.isConsumed) {
        throw new BadRequestException('SSO session already consumed');
      }

      session.userId = user.id;
      session.isConsumed = true;
      session.consumedAt = new Date();
      await queryRunner.manager.save(session);

      const code = this.pkceService.generateAuthorizationCode();
      const codeExpiresAt = new Date();
      codeExpiresAt.setSeconds(codeExpiresAt.getSeconds() + 60);

      const authCode = queryRunner.manager.create(AuthorizationCode, {
        code,
        sessionId: session.id,
        userId: user.id,
        projectId: session.projectId,
        codeChallenge: session.codeChallenge,
        codeChallengeMethod: session.codeChallengeMethod,
        redirectUri: session.returnUrl,
        state: session.state,
        expiresAt: codeExpiresAt,
        isUsed: false,
        ipAddress,
        userAgent,
      });

      await queryRunner.manager.save(authCode);

      await queryRunner.commitTransaction();

      await this.auditService.logSsoAuthorized(
        user.id,
        session.projectId,
        sessionId,
        ipAddress,
        userAgent,
      );

      await this.auditService.logCodeGenerated(
        user.id,
        session.projectId,
        sessionId,
        code,
        ipAddress,
        userAgent,
      );

      return {
        code,
        state: session.state,
        redirectUri: session.returnUrl,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    projectSlug: string,
    redirectUri: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const authCode = await queryRunner.manager.findOne(AuthorizationCode, {
        where: { code },
        relations: ['user', 'project'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!authCode) {
        await this.auditService.logCodeExchangeFailed(
          projectSlug,
          code,
          'Authorization code not found',
          ipAddress,
          userAgent,
        );
        throw new UnauthorizedException('Invalid authorization code');
      }

      if (authCode.isUsed) {
        await this.auditService.logCodeReplayDetected(
          authCode.projectId,
          code,
          ipAddress,
          userAgent,
        );
        throw new UnauthorizedException('Authorization code already used');
      }

      if (authCode.expiresAt < new Date()) {
        await this.auditService.logCodeExchangeFailed(
          authCode.projectId,
          code,
          'Authorization code expired',
          ipAddress,
          userAgent,
        );
        throw new UnauthorizedException('Authorization code expired');
      }

      if (authCode.project.slug !== projectSlug) {
        await this.auditService.logCodeExchangeFailed(
          authCode.projectId,
          code,
          'Project slug mismatch',
          ipAddress,
          userAgent,
        );
        throw new UnauthorizedException('Invalid project');
      }

      if (authCode.redirectUri !== redirectUri) {
        await this.auditService.logCodeExchangeFailed(
          authCode.projectId,
          code,
          'Redirect URI mismatch',
          ipAddress,
          userAgent,
        );
        throw new UnauthorizedException('Redirect URI mismatch');
      }

      const isPkceValid = this.pkceService.validateCodeChallenge(
        codeVerifier,
        authCode.codeChallenge,
        authCode.codeChallengeMethod,
      );

      if (!isPkceValid) {
        await this.auditService.logPkceValidationFailed(
          authCode.projectId,
          code,
          ipAddress,
          userAgent,
        );
        throw new UnauthorizedException('Invalid code verifier');
      }

      authCode.isUsed = true;
      authCode.usedAt = new Date();
      await queryRunner.manager.save(authCode);

      const accessTokenPayload = {
        sub: authCode.user.id,
        email: authCode.user.email,
        projectSlug: authCode.project.slug,
        aud: authCode.project.slug,
        type: 'access',
      };

      const accessToken = this.jwtService.sign(accessTokenPayload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION') || '15m',
      });

      const refreshTokenData = await this.generateSsoRefreshToken(
        authCode.user.id,
        authCode.project.id,
        authCode.project.slug,
        authCode.sessionId,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      await this.auditService.logCodeExchanged(
        authCode.user.id,
        authCode.projectId,
        code,
        ipAddress,
        userAgent,
      );

      const expiresIn = this.parseExpirationTime(
        this.configService.get('JWT_ACCESS_EXPIRATION') || '15m',
      );

      return {
        accessToken,
        refreshToken: refreshTokenData.token,
        tokenType: 'bearer',
        expiresIn,
        user: {
          id: authCode.user.id,
          email: authCode.user.email,
          firstName: authCode.user.firstName,
          lastName: authCode.user.lastName,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async generateSsoRefreshToken(
    userId: string,
    projectId: string,
    projectSlug: string,
    ssoSessionId: string,
    queryRunner: QueryRunner,
  ): Promise<{ token: string; tokenId: string }> {
    const expirationStr =
      this.configService.get<StringValue>('JWT_REFRESH_EXPIRATION') ?? '7d';
    const expiresAt = this.calculateExpirationDate(expirationStr);

    const refreshTokenEntity = queryRunner.manager.create(RefreshToken, {
      userId,
      projectId,
      projectSlug,
      ssoSessionId,
      expiresAt,
      token: '',
    });

    const savedToken = await queryRunner.manager.save(refreshTokenEntity);

    const refreshTokenPayload = {
      sub: userId,
      tokenId: savedToken.id,
      projectSlug,
      aud: projectSlug,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: expirationStr,
    });

    const hashedToken = await bcrypt.hash(refreshToken, 10);
    savedToken.token = hashedToken;
    await queryRunner.manager.save(savedToken);

    return { token: refreshToken, tokenId: savedToken.id };
  }

  private parseExpirationTime(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1));

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }

  private calculateExpirationDate(expiration: string): Date {
    const seconds = this.parseExpirationTime(expiration);
    const date = new Date();
    date.setSeconds(date.getSeconds() + seconds);
    return date;
  }

  async generateQuickLoginToken(
    user: User,
    projectSlug: string,
  ): Promise<{ token: string; loginUrl: string }> {
    const project = await this.projectsService.findBySlug(projectSlug);

    if (!project || !project.isActive) {
      throw new NotFoundException(
        `Project '${projectSlug}' not found or inactive`,
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + 60);

    const session = this.ssoSessionRepository.create({
      id: token,
      projectId: project.id,
      projectSlug: project.slug,
      projectName: project.name,
      returnUrl: project.allowedRedirectUrls[0],
      state: 'quick-login',
      codeChallenge: '',
      codeChallengeMethod: '',
      userId: user.id,
      expiresAt,
      isConsumed: false,
    });

    await this.ssoSessionRepository.save(session);

    const childBaseUrl = new URL(project.allowedRedirectUrls[0]).origin;
    const loginUrl = `${childBaseUrl}/auth/quick-login?token=${token}`;

    return { token, loginUrl };
  }

  async getQuickLoginSession(token: string): Promise<{
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  } | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const session = await queryRunner.manager.findOne(SsoSession, {
        where: { id: token },
        relations: ['user'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!session || session.expiresAt < new Date() || session.isConsumed) {
        await queryRunner.rollbackTransaction();
        return null;
      }

      session.isConsumed = true;
      session.consumedAt = new Date();
      await queryRunner.manager.save(session);

      await queryRunner.commitTransaction();

      if (!session.user) {
        return null;
      }

      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredSessions(): Promise<void> {
    await this.ssoSessionRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await this.ssoSessionRepository.delete({
      isConsumed: true,
      createdAt: LessThan(thirtyDaysAgo),
    });

    await this.authCodeRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    await this.authCodeRepository.delete({
      isUsed: true,
      createdAt: LessThan(oneDayAgo),
    });
  }
}
