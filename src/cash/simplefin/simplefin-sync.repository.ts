import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SimpleFinAccountSync,
  SimpleFinTransactionSync,
} from './simplefin-map.service';
import { CashAccount } from './entities/cash-account.entity';
import { CashTransaction } from './entities/cash-transaction.entity';

@Injectable()
export class SimpleFinSyncRepository {
  constructor(
    @InjectRepository(CashAccount)
    private readonly accountsRepo: Repository<CashAccount>,
    @InjectRepository(CashTransaction)
    private readonly transactionsRepo: Repository<CashTransaction>,
  ) {}

  async persistSync(
    userId: string,
    accounts: SimpleFinAccountSync[],
    transactions: SimpleFinTransactionSync[],
  ): Promise<{ accountsSaved: number; transactionsSaved: number }> {
    let accountsSaved = 0;
    let transactionsSaved = 0;

    for (const account of accounts) {
      const id = `${userId}:${account.simplefinAccountId}`;
      await this.accountsRepo.upsert(
        {
          id,
          userId,
          simplefinAccountId: account.simplefinAccountId,
          name: account.name,
          institution: account.institution ?? null,
          currency: account.currency,
          balance: String(account.balance),
          balanceDate: new Date(account.balanceDateIso),
          accountType: account.accountType,
        },
        ['id'],
      );
      accountsSaved += 1;
    }

    for (const tx of transactions) {
      const id = `${userId}:${tx.simplefinAccountId}:${tx.externalId}`;
      await this.transactionsRepo.upsert(
        {
          id,
          userId,
          simplefinAccountId: tx.simplefinAccountId,
          externalId: tx.externalId,
          postedAt: new Date(tx.postedAt),
          amount: String(tx.amount),
          description: tx.description,
        },
        ['id'],
      );
      transactionsSaved += 1;
    }

    return { accountsSaved, transactionsSaved };
  }
}
