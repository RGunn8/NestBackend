import { parse } from 'pg-connection-string';
import type { DataSourceOptions } from 'typeorm';
import { SimpleFinConnection } from '../cash/simplefin/entities/simplefin-connection.entity';
import { CashAccount } from '../cash/simplefin/entities/cash-account.entity';
import { CashTransaction } from '../cash/simplefin/entities/cash-transaction.entity';
import { User } from '../cash/users/entities/user.entity';
import { databaseHostHint, resolveDatabaseSsl } from './database.ssl';

export function buildTypeOrmConfig(
  databaseUrl: string,
  databaseSslFlag: string | undefined,
  nodeEnv: string | undefined,
): DataSourceOptions {
  const parsed = parse(databaseUrl);
  const ssl = resolveDatabaseSsl(databaseUrl, databaseSslFlag);

  if (!parsed.host || !parsed.database) {
    throw new Error('DATABASE_URL must include host and database name');
  }

  const config: DataSourceOptions = {
    type: 'postgres',
    host: parsed.host,
    port: parsed.port ? parseInt(String(parsed.port), 10) : 5432,
    username: parsed.user,
    password: parsed.password,
    database: parsed.database,
    entities: [SimpleFinConnection, User, CashAccount, CashTransaction],
    synchronize: nodeEnv !== 'production',
    ssl,
    extra: {
      connectionTimeoutMillis: 10_000,
    },
  };

  console.log('[db] TypeORM config', {
    host: databaseHostHint(databaseUrl),
    port: config.port,
    database: parsed.database,
    ssl: ssl === false ? 'disabled' : 'enabled',
    synchronize: nodeEnv !== 'production',
  });

  return config;
}
