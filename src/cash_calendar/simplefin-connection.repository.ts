import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptionService } from './encryption.service';
import { SimpleFinConnection } from './entities/simplefin-connection.entity';

export type ConnectionStatus = {
  connected: boolean;
  createdAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

@Injectable()
export class SimpleFinConnectionRepository {
  constructor(
    @InjectRepository(SimpleFinConnection)
    private readonly repo: Repository<SimpleFinConnection>,
    private readonly encryption: EncryptionService,
  ) {}

  async upsert(userId: string, accessUrl: string): Promise<void> {
    const encrypted = this.encryption.encrypt(accessUrl);
    const existing = await this.repo.findOne({ where: { userId } });

    if (existing) {
      existing.accessUrl = encrypted;
      existing.lastSyncAt = null;
      existing.lastSyncError = null;
      await this.repo.save(existing);
      return;
    }

    await this.repo.save({
      userId,
      accessUrl: encrypted,
      createdAt: new Date(),
      lastSyncAt: null,
      lastSyncError: null,
    });
  }

  async getAccessUrl(userId: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row) return null;
    return this.encryption.decrypt(row.accessUrl);
  }

  async getLastSyncAt(userId: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { userId } });
    return row?.lastSyncAt?.toISOString() ?? null;
  }

  async updateSyncMeta(
    userId: string,
    lastSyncError: string | null,
  ): Promise<void> {
    await this.repo.update(
      { userId },
      { lastSyncAt: new Date(), lastSyncError },
    );
  }

  async delete(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  async getStatus(userId: string): Promise<ConnectionStatus> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row) {
      return {
        connected: false,
        createdAt: null,
        lastSyncAt: null,
        lastSyncError: null,
      };
    }
    return {
      connected: true,
      createdAt: row.createdAt.toISOString(),
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      lastSyncError: row.lastSyncError,
    };
  }
}
