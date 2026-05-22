import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

function sslFromEnv() {
  if (process.env.DATABASE_SSL === 'false') return false;
  const url = process.env.DATABASE_URL ?? '';
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
  return { rejectUnauthorized: false };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const migrationsDir = [
    path.join(process.cwd(), 'src/database/migrations'),
    path.join(process.cwd(), 'dist/database/migrations'),
  ].find((dir) => fs.existsSync(dir));

  if (!migrationsDir) {
    throw new Error('No migrations directory found');
  }
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const client = new Client({
    connectionString: databaseUrl,
    ssl: sslFromEnv(),
  });

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const applied = await client.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.rows.map((row) => row.filename));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
