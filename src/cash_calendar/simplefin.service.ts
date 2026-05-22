import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SimpleFinAccountSet } from './interfaces/simplefin.types';

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
    const response = await fetch(claimUrl, { method: 'POST' });

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
    const url = new URL(this.accountsEndpoint(accessUrl));

    if (options?.startDate !== undefined) {
      url.searchParams.set('start-date', String(Math.floor(options.startDate)));
    }
    if (options?.endDate !== undefined) {
      url.searchParams.set('end-date', String(options.endDate));
    }
    if (options?.pending) {
      url.searchParams.set('pending', '1');
    }
    url.searchParams.set('version', '2');

    const response = await fetch(url.toString(), { method: 'GET' });

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

  private accountsEndpoint(accessUrl: string): string {
    const normalized = accessUrl.replace(/\/$/, '');
    return normalized.endsWith('/accounts')
      ? normalized
      : `${normalized}/accounts`;
  }
}
