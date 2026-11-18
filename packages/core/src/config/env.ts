export interface Env {
  databaseUrl: string;
  sessionSecret: string;
}

// Gọi lúc cần (container tạo lười), không đọc env lúc import để build/test không cần secret.
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const databaseUrl = source.DATABASE_URL;
  if (!databaseUrl) throw new Error('Thiếu biến môi trường DATABASE_URL');
  const sessionSecret = source.SESSION_SECRET;
  if (!sessionSecret) throw new Error('Thiếu biến môi trường SESSION_SECRET');
  if (Buffer.byteLength(sessionSecret, 'utf8') < 32) throw new Error('SESSION_SECRET phải dài ít nhất 32 byte');
  return { databaseUrl, sessionSecret };
}
