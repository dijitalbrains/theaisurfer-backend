import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

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

  @Column({ type: 'varchar', length: 64, nullable: true })
  state?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'is_consumed', type: 'tinyint', width: 1, default: 0 })
  isConsumed: boolean;
}
