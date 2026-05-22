export function resolveDatabaseSsl(
  databaseUrl: string,
  databaseSslFlag: string | undefined,
): false | { rejectUnauthorized: boolean } {
  if (databaseSslFlag === 'false') return false;
  if (databaseSslFlag === 'true') {
    return { rejectUnauthorized: false };
  }

  if (
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1') ||
    databaseUrl.includes('.railway.internal')
  ) {
    return false;
  }

  if (/sslmode=disable/i.test(databaseUrl)) {
    return false;
  }

  return { rejectUnauthorized: false };
}

export function databaseHostHint(databaseUrl: string): string {
  try {
    const normalized = databaseUrl.replace(/^postgres(ql)?:\/\//, 'http://');
    const host = new URL(normalized).hostname;
    return host || 'unknown';
  } catch {
    return 'unknown';
  }
}
