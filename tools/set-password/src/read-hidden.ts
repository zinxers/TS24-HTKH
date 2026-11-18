import type { Readable, Writable } from 'node:stream';

/** Người dùng bấm Ctrl+C/Ctrl+D, hoặc dữ liệu nhập kết thúc trước Enter. */
export class InputCancelledError extends Error {
  constructor() {
    super('Đã hủy');
    this.name = 'InputCancelledError';
  }
}

type Input = Readable & { isTTY?: boolean; isRaw?: boolean; setRawMode?: (mode: boolean) => unknown };

// Phần còn lại của chunk khi nhiều dòng tới cùng lúc (dán), theo từng stream.
const pending = new WeakMap<Input, string>();

/** Đọc một dòng mà không hiện ký tự. Chỉ ẩn được khi `input` là TTY (PowerShell, cmd). */
export function readHidden(
  prompt: string,
  input: Input = process.stdin,
  output: Writable = process.stdout,
): Promise<string> {
  output.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = input.isRaw ?? false;
    if (input.isTTY) input.setRawMode?.(true);
    input.setEncoding('utf8');

    let settled = false;
    const done = (error?: Error) => {
      if (settled) return;
      settled = true;
      input.off('data', onData);
      input.off('end', onEnd);
      if (input.isTTY) input.setRawMode?.(wasRaw);
      input.pause();
      output.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onEnd = () => done(new InputCancelledError());

    const onData = (chunk: string) => {
      const chars = [...chunk];
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]!;
        if (ch === '\r' || ch === '\n') {
          pending.set(input, chars.slice(ch === '\r' && chars[i + 1] === '\n' ? i + 2 : i + 1).join(''));
          return done();
        }
        if (ch === '\u0003' || ch === '\u0004') return done(new InputCancelledError());
        if (ch === '\u0008' || ch === '\u007f') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };

    const rest = pending.get(input);
    pending.delete(input);
    input.on('data', onData);
    input.on('end', onEnd);
    if (rest) onData(rest);
    if (input.readableEnded) onEnd();
    else input.resume();
  });
}
