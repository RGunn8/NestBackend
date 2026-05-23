import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';
import { UsersService } from '../users/users.service';
import { SimpleFinConnectionRepository } from './simplefin-connection.repository';
import { SimpleFinMapService } from './simplefin-map.service';
import {
  clampSyncDateRange,
  defaultSyncStartSec,
  SIMPLEFIN_MAX_SYNC_DAYS,
} from './simplefin-sync.dates';
import { SimpleFinSyncRepository } from './simplefin-sync.repository';
import { SimpleFinService } from './simplefin.service';

@Injectable()
export class SimpleFinOrchestratorService {
  private readonly logger = new Logger(SimpleFinOrchestratorService.name);
  private readonly defaultSyncDays: number;
  private readonly syncOverlapDays: number;

  constructor(
    private readonly simpleFin: SimpleFinService,
    private readonly map: SimpleFinMapService,
    private readonly connections: SimpleFinConnectionRepository,
    private readonly syncRepo: SimpleFinSyncRepository,
    private readonly users: UsersService,
    config: ConfigService,
  ) {
    this.defaultSyncDays =
      Number(config.get('SIMPLEFIN_SYNC_DAYS') ?? '90') || 90;
    this.syncOverlapDays =
      Number(config.get('SIMPLEFIN_SYNC_OVERLAP_DAYS') ?? '7') || 7;
  }

  async claim(userId: string, token: string) {
    await this.requireUser(userId);

    const claimUrl = this.simpleFin.decodeSetupToken(token);
    const accessUrl = await this.simpleFin.claimAccessUrl(claimUrl);
    await this.connections.upsert(userId, accessUrl);
    return { ok: true, connected: true };
  }

  async sync(userId: string, startDateSec?: number) {
    await this.requireUser(userId);

    const accessUrl = await this.connections.getAccessUrl(userId);
    if (!accessUrl) {
      throw new HttpException(
        { error: 'Not connected', code: 'not_connected' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const lastSyncAt = await this.connections.getLastSyncAt(userId);
    const now = Math.floor(Date.now() / 1000);
    const requestedStart =
      typeof startDateSec === 'number' && startDateSec > 0
        ? Math.floor(startDateSec)
        : defaultSyncStartSec(
            lastSyncAt,
            this.defaultSyncDays,
            this.syncOverlapDays,
          );

    const { startDateSec: start, endDateSec: end, capped } = clampSyncDateRange(
      requestedStart,
      now,
      Math.min(this.defaultSyncDays, SIMPLEFIN_MAX_SYNC_DAYS),
    );

    const raw = await this.simpleFin.fetchAccounts(accessUrl, {
      startDate: start,
      endDate: end,
    });
    const { accounts, transactions, errors } =
      this.map.normalizeAccountSet(raw);

    const warnings = [...errors];
    if (capped) {
      warnings.unshift(
        `Date range was capped to ${Math.min(this.defaultSyncDays, SIMPLEFIN_MAX_SYNC_DAYS)} days (SimpleFIN limit is 90 days).`,
      );
    }

    let saved = { accountsSaved: 0, transactionsSaved: 0 };
    try {
      saved = await this.syncRepo.persistSync(userId, accounts, transactions);
    } catch (error) {
      this.logger.error('Failed to persist SimpleFIN sync', error);
      const message =
        error instanceof QueryFailedError
          ? `Database error while saving accounts: ${error.message}`
          : 'Failed to save synced accounts to the database';
      throw new HttpException(
        { error: message, code: 'sync_persist_failed' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const nowIso = new Date().toISOString();
    await this.connections.updateSyncMeta(
      userId,
      warnings.length ? warnings.join('; ') : null,
    );

    return {
      ok: true,
      syncedAt: nowIso,
      startDateSec: start,
      endDateSec: end,
      dateRangeCapped: capped,
      accounts,
      transactions,
      errors: warnings,
      saved,
    };
  }

  async disconnect(userId: string) {
    await this.connections.delete(userId);
    return { ok: true, connected: false };
  }

  async status(userId: string) {
    return this.connections.getStatus(userId);
  }

  private async requireUser(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new HttpException(
        {
          error: `User "${userId}" not found. Create the user first via POST /cash/users.`,
          code: 'user_not_found',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
