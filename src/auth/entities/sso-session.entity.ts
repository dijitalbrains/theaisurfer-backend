import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';

@Entity('sso_sessions')
export class SsoSession {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ name: 'project_id', type: 'char', length: 36 })
  projectId: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_slug', type: 'varchar' })
  projectSlug: string;

  @Column({ name: 'project_name', type: 'varchar' })
  projectName: string;

  @Column({ name: 'return_url', type: 'text' })
  returnUrl: string;

  @Column({ type: 'varchar', length: 64 })
  state: string;

  @Column({ name: 'code_challenge', type: 'varchar', length: 128, default: '' })
  codeChallenge: string;

  @Column({
    name: 'code_challenge_method',
    type: 'varchar',
    length: 10,
    default: 'S256',
  })
  codeChallengeMethod: string;

  @Column({ name: 'user_id', type: 'char', length: 36, nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'is_consumed', type: 'tinyint', width: 1, default: 0 })
  isConsumed: boolean;

  @Column({ name: 'consumed_at', type: 'timestamp', nullable: true })
  consumedAt?: Date;
}
