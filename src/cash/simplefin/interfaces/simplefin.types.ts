export interface SimpleFinError {
  code: string;
  msg?: string;
  message?: string;
  conn_id?: string;
  account_id?: string;
}

export interface SimpleFinConnection {
  conn_id: string;
  name: string;
  org_id: string;
  org_url?: string;
  sfin_url: string;
}

export interface SimpleFinTransaction {
  id: string;
  posted: number;
  amount: string;
  description: string;
  transacted_at?: number;
  pending?: boolean;
  extra?: Record<string, unknown>;
}

export interface SimpleFinAccount {
  id: string;
  name: string;
  conn_id: string;
  currency: string;
  balance: string;
  'available-balance'?: string;
  'balance-date': number;
  transactions?: SimpleFinTransaction[];
  extra?: Record<string, unknown>;
}

export interface SimpleFinAccountSet {
  errlist: SimpleFinError[];
  errors?: string[];
  connections: SimpleFinConnection[];
  accounts: SimpleFinAccount[];
}
