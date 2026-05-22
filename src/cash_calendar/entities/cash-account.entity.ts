import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('cash_accounts')
export class CashAccount {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @Column({ name: 'simplefin_account_id', type: 'text' })
  simplefinAccountId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  institution!: string | null;

  @Column({ type: 'text', default: 'USD' })
  currency!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  balance!: string;

  @Column({ name: 'balance_date', type: 'timestamptz', nullable: true })
  balanceDate!: Date | null;

  @Column({ name: 'account_type', type: 'text', default: 'checking' })
  accountType!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
