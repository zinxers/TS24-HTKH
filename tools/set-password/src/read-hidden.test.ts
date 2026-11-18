import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { InputCancelledError, readHidden } from './read-hidden';

function streams() {
  const input = new PassThrough();
  const output = new PassThrough();
  let written = '';
  output.on('data', (c: Buffer) => (written += c.toString()));
  return { input, output, written: () => written };
}

describe('readHidden', () => {
  it('đọc tới Enter, xử lý Backspace, không ghi ký tự ra màn hình', async () => {
    const s = streams();
    const p = readHidden('Mật khẩu: ', s.input, s.output);
    s.input.write('abx\u007fc\r');
    await expect(p).resolves.toBe('abc');
    expect(s.written()).toBe('Mật khẩu: \n');
  });

  it('nhiều dòng tới cùng lúc: lần đọc sau lấy phần còn lại', async () => {
    const s = streams();
    const first = readHidden('', s.input, s.output);
    s.input.write('mot\nhai\n');
    await expect(first).resolves.toBe('mot');
    await expect(readHidden('', s.input, s.output)).resolves.toBe('hai');
  });

  it('Ctrl+C → InputCancelledError', async () => {
    const s = streams();
    const p = readHidden('', s.input, s.output);
    s.input.write('ab\u0003');
    await expect(p).rejects.toBeInstanceOf(InputCancelledError);
  });

  it('dữ liệu nhập kết thúc trước Enter → InputCancelledError', async () => {
    const s = streams();
    const p = readHidden('', s.input, s.output);
    s.input.end('ab');
    await expect(p).rejects.toBeInstanceOf(InputCancelledError);
  });
});
