import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('user_mappings')
@Index('uq_user_mappings_pair', ['id1', 'id2'], { unique: true })
export class UserMapping {
  @PrimaryColumn({ name: 'user_id', type: 'char', length: 36 })
  userID!: string;

  @Column({ type: 'varchar', length: 128, collation: 'utf8mb4_0900_bin' })
  id1!: string;

  @Column({ type: 'varchar', length: 128, collation: 'utf8mb4_0900_bin' })
  id2!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
