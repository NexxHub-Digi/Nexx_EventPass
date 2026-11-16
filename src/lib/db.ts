import postgres from 'postgres';
let client: ReturnType<typeof postgres> | undefined;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!client) client = postgres(process.env.DATABASE_URL, { max: 5, ssl: 'require', prepare: false, idle_timeout: 20 });
  return client;
}
