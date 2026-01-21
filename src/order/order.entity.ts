import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ length: 50 })
  type: string;

  @Column('int')
  quantity: number;

  @Column('int')
  price: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
