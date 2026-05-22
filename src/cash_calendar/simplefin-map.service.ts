import { Injectable } from '@nestjs/common';

export type SimpleFinRawTransaction = {
  id: string;
  posted: number;
  amount: string;
  description: string;
  pending?: boolean;
};

export type SimpleFinRawAccount = {
  id: string;
  name: string;
  conn_id?: string;
  currency: string;
  balance: string;
  'balance-date'?: number;
  transactions?: SimpleFinRawTransaction[];
};

export type SimpleFinAccountSync = {
  simplefinAccountId: string;
  name: string;
  institution?: string;
  currency: string;
  balance: number;
  balanceDateIso: string;
  accountType: 'checking' | 'savings' | 'credit';
};

export type SimpleFinTransactionSync = {
  simplefinAccountId: string;
  externalId: string;
  postedAt: string;
  amount: number;
  description: string;
};

@Injectable()
export class SimpleFinMapService {
  shouldImportSimpleFinTransaction(t: SimpleFinRawTransaction): boolean {
    if (t.pending === true) return false;
    if (!t.posted || t.posted <= 0) return false;
    const amt = Number(t.amount);
    if (!Number.isFinite(amt)) return false;
    const desc = String(t.description ?? '').trim();
    if (!desc) return false;
    if (!String(t.id ?? '').trim()) return false;
    return true;
  }

  unixToIsoDateTime(sec: number): string {
    const d = new Date(sec * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}T12:00:00.000Z`;
  }

  inferAccountType(
    name: string,
    balance: number,
  ): 'checking' | 'savings' | 'credit' {
    const n = name.toLowerCase();
    if (
      n.includes('credit') ||
      n.includes('card') ||
      n.includes('visa') ||
      n.includes('mastercard')
    ) {
      return 'credit';
    }
    if (n.includes('saving')) return 'savings';
    if (balance < 0 && !n.includes('checking')) return 'credit';
    return 'checking';
  }

  mapSimpleFinTransaction(
    accountId: string,
    t: SimpleFinRawTransaction,
  ): SimpleFinTransactionSync | null {
    if (!this.shouldImportSimpleFinTransaction(t)) return null;
    return {
      simplefinAccountId: accountId,
      externalId: String(t.id),
      postedAt: this.unixToIsoDateTime(t.posted),
      amount: Number(t.amount),
      description: String(t.description).trim(),
    };
  }

  mapSimpleFinAccount(
    a: SimpleFinRawAccount,
    institutionByConnId: Record<string, string>,
  ): SimpleFinAccountSync {
    const balance = Number(a.balance);
    const balanceDateIso =
      typeof a['balance-date'] === 'number'
        ? this.unixToIsoDateTime(a['balance-date'])
        : new Date().toISOString();
    const connId = a.conn_id ?? '';
    return {
      simplefinAccountId: String(a.id),
      name: String(a.name ?? 'Account').trim() || 'Account',
      institution: institutionByConnId[connId],
      currency: String(a.currency ?? 'USD'),
      balance: Number.isFinite(balance) ? balance : 0,
      balanceDateIso,
      accountType: this.inferAccountType(String(a.name ?? ''), balance),
    };
  }

  normalizeAccountSet(raw: {
    errlist?: { msg?: string }[];
    connections?: { conn_id?: string; name?: string }[];
    accounts?: SimpleFinRawAccount[];
  }) {
    const institutionByConnId: Record<string, string> = {};
    for (const c of raw.connections ?? []) {
      if (c.conn_id && c.name) institutionByConnId[c.conn_id] = String(c.name);
    }

    const errors = (raw.errlist ?? [])
      .map((e) => String(e.msg ?? '').trim())
      .filter(Boolean)
      .slice(0, 10);

    const accounts: SimpleFinAccountSync[] = [];
    const transactions: SimpleFinTransactionSync[] = [];

    for (const a of raw.accounts ?? []) {
      const mapped = this.mapSimpleFinAccount(a, institutionByConnId);
      accounts.push(mapped);
      for (const t of a.transactions ?? []) {
        const tx = this.mapSimpleFinTransaction(String(a.id), t);
        if (tx) transactions.push(tx);
      }
    }

    return { accounts, transactions, errors };
  }
}
