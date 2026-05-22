import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SimpleFinConnectionRepository } from './simplefin-connection.repository';
import { SimpleFinMapService } from './simplefin-map.service';
import { SimpleFinService } from './simplefin.service';

@Injectable()
export class SimpleFinOrchestratorService {
  private readonly defaultSyncDays: number;
  private readonly syncOverlapDays: number;

  constructor(
    private readonly simpleFin: SimpleFinService,
    private readonly map: SimpleFinMapService,
    private readonly connections: SimpleFinConnectionRepository,
    config: ConfigService,
  ) {
    this.defaultSyncDays =
      Number(config.get('SIMPLEFIN_SYNC_DAYS') ?? '90') || 90;
    this.syncOverlapDays =
      Number(config.get('SIMPLEFIN_SYNC_OVERLAP_DAYS') ?? '7') || 7;
  }

  async claim(userId: string, token: string) {
    const claimUrl = this.simpleFin.decodeSetupToken(token);
    const accessUrl = await this.simpleFin.claimAccessUrl(claimUrl);
    await this.connections.upsert(userId, accessUrl);
    return { ok: true, connected: true };
  }

  async sync(userId: string, startDateSec?: number) {
    const accessUrl = await this.connections.getAccessUrl(userId);
    if (!accessUrl) {
      throw new HttpException(
        { error: 'Not connected', code: 'not_connected' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const lastSyncAt = await this.connections.getLastSyncAt(userId);
    const start =
      typeof startDateSec === 'number' && startDateSec > 0
        ? startDateSec
        : this.defaultStartDateSec(lastSyncAt);

    const raw = await this.simpleFin.fetchAccounts(accessUrl, {
      startDate: start,
    });
    const { accounts, transactions, errors } =
      this.map.normalizeAccountSet(raw);

    const now = new Date().toISOString();
    await this.connections.updateSyncMeta(
      userId,
      errors.length ? errors.join('; ') : null,
    );

    return {
      ok: true,
      syncedAt: now,
      startDateSec: start,
      accounts,
      transactions,
      errors,
    };
  }

  async disconnect(userId: string) {
    await this.connections.delete(userId);
    return { ok: true, connected: false };
  }

  async status(userId: string) {
    return this.connections.getStatus(userId);
  }

  private defaultStartDateSec(lastSyncAt: string | null): number {
    const now = Math.floor(Date.now() / 1000);
    if (!lastSyncAt) {
      return now - this.defaultSyncDays * 86400;
    }
    const last = Math.floor(new Date(lastSyncAt).getTime() / 1000);
    if (!Number.isFinite(last)) return now - this.defaultSyncDays * 86400;
    return last - this.syncOverlapDays * 86400;
  }
}
