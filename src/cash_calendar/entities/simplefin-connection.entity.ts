import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('simplefin_connections')
export class SimpleFinConnection {
  @PrimaryColumn({ name: 'user_id', type: 'text' })
  userId!: string;

  @Column({ name: 'access_url', type: 'text' })
  accessUrl!: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  @Column({ name: 'last_sync_error', type: 'text', nullable: true })
  lastSyncError!: string | null;
}
