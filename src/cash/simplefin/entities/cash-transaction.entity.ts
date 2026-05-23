import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('cash_transactions')
export class CashTransaction {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @Column({ name: 'simplefin_account_id', type: 'text' })
  simplefinAccountId!: string;

  @Column({ name: 'external_id', type: 'text' })
  externalId!: string;

  @Column({ name: 'posted_at', type: 'timestamptz' })
  postedAt!: Date;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'text' })
  description!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
