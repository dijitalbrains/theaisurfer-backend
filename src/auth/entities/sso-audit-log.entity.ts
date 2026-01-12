import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';

export enum SsoAuditEventType {
  SSO_INITIATED = 'sso_initiated',
  SSO_AUTHORIZED = 'sso_authorized',
  CODE_GENERATED = 'code_generated',
  CODE_EXCHANGED = 'code_exchanged',
  CODE_EXCHANGE_FAILED = 'code_exchange_failed',
  TOKEN_VALIDATED = 'token_validated',
  TOKEN_VALIDATION_FAILED = 'token_validation_failed',
  TOKEN_REFRESHED = 'token_refreshed',
  SESSION_EXPIRED = 'session_expired',
  INVALID_REDIRECT_URL = 'invalid_redirect_url',
  INVALID_API_KEY = 'invalid_api_key',
  PKCE_VALIDATION_FAILED = 'pkce_validation_failed',
  CSRF_VALIDATION_FAILED = 'csrf_validation_failed',
  CODE_REPLAY_DETECTED = 'code_replay_detected',
}

@Entity('sso_audit_log')
@Index(['eventType', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['projectId', 'createdAt'])
export class SsoAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'event_type',
    type: 'varchar',
    length: 50,
    enum: SsoAuditEventType,
  })
  eventType: SsoAuditEventType;

  @Column({ name: 'user_id', type: 'char', length: 36, nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'project_id', type: 'char', length: 36, nullable: true })
  projectId?: string;

  @ManyToOne(() => Project, { nullable: true })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ name: 'session_id', type: 'varchar', length: 64, nullable: true })
  sessionId?: string;

  @Column({
    name: 'authorization_code',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  authorizationCode?: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  success: boolean;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
