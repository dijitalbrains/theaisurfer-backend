import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SsoSession } from './sso-session.entity';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';

@Entity('authorization_codes')
export class AuthorizationCode {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  code: string;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId: string;

  @ManyToOne(() => SsoSession)
  @JoinColumn({ name: 'session_id' })
  session: SsoSession;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'project_id', type: 'char', length: 36 })
  projectId: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'code_challenge', type: 'varchar', length: 128 })
  codeChallenge: string;

  @Column({
    name: 'code_challenge_method',
    type: 'varchar',
    length: 10,
    default: 'S256',
  })
  codeChallengeMethod: string;

  @Column({ name: 'redirect_uri', type: 'text' })
  redirectUri: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  state?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'is_used', type: 'tinyint', width: 1, default: 0 })
  isUsed: boolean;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt?: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;
}
