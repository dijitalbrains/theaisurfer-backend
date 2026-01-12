import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SsoAuditLog,
  SsoAuditEventType,
} from './entities/sso-audit-log.entity';

export interface AuditLogData {
  eventType: SsoAuditEventType;
  userId?: string;
  projectId?: string;
  sessionId?: string;
  authorizationCode?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(SsoAuditLog)
    private readonly auditLogRepository: Repository<SsoAuditLog>,
  ) {}

  async log(data: AuditLogData): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create(data);
      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      console.error('[Audit] Failed to write audit log:', error);
    }
  }

  async logSsoInitiated(
    projectId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      eventType: SsoAuditEventType.SSO_INITIATED,
      projectId,
      sessionId,
      ipAddress,
      userAgent,
      success: true,
    });
  }

  async logSsoAuthorized(
    userId: string,
    projectId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      eventType: SsoAuditEventType.SSO_AUTHORIZED,
      userId,
      projectId,
      sessionId,
      ipAddress,
      userAgent,
      success: true,
    });
  }

  async logCodeGenerated(
    userId: string,
    projectId: string,
    sessionId: string,
    authorizationCode: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      eventType: SsoAuditEventType.CODE_GENERATED,
      userId,
      projectId,
      sessionId,
      authorizationCode,
      ipAddress,
      userAgent,
      success: true,
    });
  }

  async logCodeExchanged(
    userId: string,
    projectId: string,
    authorizationCode: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      eventType: SsoAuditEventType.CODE_EXCHANGED,
      userId,
      projectId,
      authorizationCode,
      ipAddress,
      userAgent,
      success: true,
    });
  }

  async logCodeExchangeFailed(
    projectId: string,
    authorizationCode: string,
    errorMessage: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      eventType: SsoAuditEventType.CODE_EXCHANGE_FAILED,
      projectId,
      authorizationCode,
      ipAddress,
      userAgent,
      success: false,
      errorMessage,
    });
  }

  async logPkceValidationFailed(
    projectId: string,
    authorizationCode: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      eventType: SsoAuditEventType.PKCE_VALIDATION_FAILED,
      projectId,
      authorizationCode,
      ipAddress,
      userAgent,
      success: false,
      errorMessage: 'PKCE code verifier validation failed',
    });
  }

  async logCsrfValidationFailed(
    projectId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      eventType: SsoAuditEventType.CSRF_VALIDATION_FAILED,
      projectId,
      sessionId,
      ipAddress,
      userAgent,
      success: false,
      errorMessage: 'CSRF state validation failed',
    });
  }

  async logCodeReplayDetected(
    projectId: string,
    authorizationCode: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      eventType: SsoAuditEventType.CODE_REPLAY_DETECTED,
      projectId,
      authorizationCode,
      ipAddress,
      userAgent,
      success: false,
      errorMessage: 'Authorization code already used',
    });
  }

  async logInvalidRedirectUrl(
    projectId: string,
    sessionId: string,
    metadata: { attemptedUrl: string; allowedUrls: string[] },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      eventType: SsoAuditEventType.INVALID_REDIRECT_URL,
      projectId,
      sessionId,
      ipAddress,
      userAgent,
      success: false,
      errorMessage: 'Redirect URL not in whitelist',
      metadata,
    });
  }

  async logInvalidApiKey(
    projectId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      eventType: SsoAuditEventType.INVALID_API_KEY,
      projectId,
      ipAddress,
      userAgent,
      success: false,
      errorMessage: 'Invalid API key',
    });
  }
}
