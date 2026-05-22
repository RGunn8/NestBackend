import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SimpleFinAccountSet } from './interfaces/simplefin.types';

type AccountsRequest = {
  url: string;
  headers: Record<string, string>;
};

@Injectable()
export class SimpleFinService {
  private readonly logger = new Logger(SimpleFinService.name);

  decodeSetupToken(token: string): string {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new BadRequestException('SimpleFIN token is required');
    }

    let claimUrl: string;
    try {
      claimUrl = Buffer.from(trimmed, 'base64').toString('utf8').trim();
    } catch {
      throw new BadRequestException('Invalid SimpleFIN token encoding');
    }

    if (!claimUrl.startsWith('https://')) {
      throw new BadRequestException(
        'Invalid SimpleFIN token: decoded URL must use HTTPS',
      );
    }

    return claimUrl;
  }

  async claimAccessUrl(claimUrl: string): Promise<string> {
    const response = await fetch(claimUrl, {
      method: 'POST',
      headers: { 'Content-Length': '0' },
    });

    if (response.status === 403) {
      throw new ForbiddenException(
        'This SimpleFIN token was already used or is invalid. Create a new token at https://bridge.simplefin.org/simplefin/create',
      );
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `SimpleFIN claim failed (${response.status}): ${body}`,
      );
      throw new InternalServerErrorException(
        'Failed to claim SimpleFIN access URL',
      );
    }

    const accessUrl = (await response.text()).trim();
    if (!accessUrl.startsWith('https://')) {
      throw new InternalServerErrorException(
        'SimpleFIN returned an invalid access URL',
      );
    }

    return accessUrl;
  }

  async fetchAccounts(
    accessUrl: string,
    options?: { startDate?: number; endDate?: number; pending?: boolean },
  ): Promise<SimpleFinAccountSet> {
    const { url, headers } = this.buildAccountsRequest(accessUrl, options);

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (response.status === 403) {
      throw new ForbiddenException(
        'SimpleFIN access was revoked or credentials are invalid',
      );
    }

    if (response.status === 402) {
      throw new ForbiddenException('SimpleFIN payment required');
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `SimpleFIN accounts fetch failed (${response.status}): ${body}`,
      );
      throw new InternalServerErrorException(
        'Failed to fetch accounts from SimpleFIN',
      );
    }

    return (await response.json()) as SimpleFinAccountSet;
  }

  private buildAccountsRequest(
    accessUrl: string,
    options?: { startDate?: number; endDate?: number; pending?: boolean },
  ): AccountsRequest {
    const u = new URL(accessUrl);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (u.username || u.password) {
      const auth =
        'Basic ' +
        Buffer.from(`${u.username}:${u.password}`).toString('base64');
      headers.Authorization = auth;
      u.username = '';
      u.password = '';
    }

    const pathname = u.pathname.replace(/\/$/, '');
    u.pathname = pathname.endsWith('/accounts')
      ? pathname
      : `${pathname}/accounts`;

    if (options?.startDate !== undefined) {
      u.searchParams.set('start-date', String(Math.floor(options.startDate)));
    }
    if (options?.endDate !== undefined) {
      u.searchParams.set('end-date', String(options.endDate));
    }
    if (options?.pending) {
      u.searchParams.set('pending', '1');
    }
    u.searchParams.set('version', '2');

    return { url: u.toString(), headers };
  }
}
