import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, phc: string): Promise<boolean>;
}

const MEMORY = 19456;
const PASSES = 2;
const PARALLELISM = 1;
const TAG_LENGTH = 32;
const PHC_RE = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

// Hash của một chuỗi ngẫu nhiên đã bỏ đi; dùng khi email không tồn tại để thời gian phản hồi như nhau.
export const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$g1xjzXN+EpnwKWfta7nZ1w$8zdAb7FFudehTy2IQ/9A6ZdlEyliFubBRDSUErV7ai8';

function derive(
  message: string,
  nonce: Buffer,
  memory: number,
  passes: number,
  parallelism: number,
  tagLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2('argon2id', { message, nonce, memory, passes, parallelism, tagLength }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

const b64 = (buf: Buffer) => buf.toString('base64').replace(/=+$/, '');

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const nonce = randomBytes(16);
    const tag = await derive(password, nonce, MEMORY, PASSES, PARALLELISM, TAG_LENGTH);
    return `$argon2id$v=19$m=${MEMORY},t=${PASSES},p=${PARALLELISM}$${b64(nonce)}$${b64(tag)}`;
  }

  async verify(password: string, phc: string): Promise<boolean> {
    const m = PHC_RE.exec(phc);
    if (!m) return false;
    const expected = Buffer.from(m[5]!, 'base64');
    try {
      const actual = await derive(
        password,
        Buffer.from(m[4]!, 'base64'),
        Number(m[1]),
        Number(m[2]),
        Number(m[3]),
        expected.length,
      );
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
