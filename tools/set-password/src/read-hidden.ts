// Phần còn lại của chunk khi stdin là pipe (nhiều dòng tới cùng lúc).
let pending = '';

/** Đọc một dòng từ terminal mà không hiện ký tự (chạy được trong PowerShell, cmd, bash). */
export function readHidden(prompt: string): Promise<string> {
  const { stdin, stdout } = process;
  stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const done = (error?: Error) => {
      stdin.off('data', onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk: string) => {
      const chars = [...chunk];
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]!;
        if (ch === '\r' || ch === '\n') {
          pending = chars.slice(chars[i + 1] === '\n' && ch === '\r' ? i + 2 : i + 1).join('');
          return done();
        }
        if (ch === '\u0003') return done(new Error('Đã hủy'));
        if (ch === '\u0008' || ch === '\u007f') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
    if (pending) {
      const rest = pending;
      pending = '';
      onData(rest);
    }
  });
}
