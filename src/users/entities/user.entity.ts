import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({
    name: 'stripe_customer_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeCustomerId: string | null;

  @Column({
    name: 'stripe_source_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeSourceId: string | null;

  @Column({
    name: 'credits',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
    nullable: true,
    transformer: {
      to: (value) => value,
      from: (value) =>
        value === null || value === undefined ? 0 : parseFloat(value),
    },
  })
  credits: number | null;

  @Column({
    name: 'purchased_credits',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
    transformer: {
      to: (value) => value,
      from: (value) =>
        value === null || value === undefined ? 0 : parseFloat(value),
    },
  })
  purchasedCredits: number;

  @Column({ name: 'has_unlimited_credits', type: 'boolean', default: false })
  hasUnlimitedCredits: boolean;

  @Column({ name: 'auto_reload', type: 'boolean', default: false })
  autoReload: boolean;

  @Column({ name: 'reload_threshold', type: 'int', nullable: true })
  reloadThreshold: number;

  @Column({
    name: 'reload_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value) => value,
      from: (value) =>
        value === null || value === undefined ? null : parseFloat(value),
    },
  })
  reloadAmount: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
