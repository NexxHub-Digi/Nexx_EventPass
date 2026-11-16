import postgres from 'postgres';
let client: ReturnType<typeof postgres> | undefined;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const localCiDatabase=process.env.CI==='true' && process.env.EVENTPASS_E2E==='true' && /@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL);
  if (!client) client = postgres(process.env.DATABASE_URL, { max: 5, ssl: localCiDatabase ? false : 'require', prepare: false, idle_timeout: 20 });
  return client;
}
