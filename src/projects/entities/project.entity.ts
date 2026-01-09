import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserProject } from './user-project.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column('json', { name: 'allowed_redirect_urls', nullable: true })
  allowedRedirectUrls: string[];

  @Column({ name: 'api_key', unique: true, nullable: true })
  @Exclude()
  apiKey: string;

  @OneToMany(() => UserProject, (userProject) => userProject.project)
  userProjects: UserProject[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
