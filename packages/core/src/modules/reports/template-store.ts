import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type TemplateName = 'report-WR' | 'report-MR' | 'report-QR' | 'doi-soat';

export interface TemplateStore {
  load(name: TemplateName): Promise<Uint8Array>;
}

/** Đọc `<name>.xlsx` trong `dir`, giữ trong bộ nhớ sau lần đọc đầu. */
export class FsTemplateStore implements TemplateStore {
  private readonly cache = new Map<TemplateName, Promise<Uint8Array>>();

  constructor(private readonly dir: string) {}

  load(name: TemplateName): Promise<Uint8Array> {
    let p = this.cache.get(name);
    if (!p) {
      p = readFile(path.join(this.dir, `${name}.xlsx`)).then((b) => new Uint8Array(b));
      p.catch(() => this.cache.delete(name)); // lỗi đọc thì lần sau đọc lại
      this.cache.set(name, p);
    }
    return p;
  }
}
