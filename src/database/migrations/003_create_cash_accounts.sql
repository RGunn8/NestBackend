-- Cash accounts synced from SimpleFIN
CREATE TABLE IF NOT EXISTS cash_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  simplefin_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  institution TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  balance_date TIMESTAMPTZ,
  account_type TEXT NOT NULL DEFAULT 'checking',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, simplefin_account_id)
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  simplefin_account_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, simplefin_account_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_user_posted
  ON cash_transactions (user_id, posted_at DESC);
