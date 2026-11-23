import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReportType } from '@ts24-htkh/shared';

export interface TemplateStore {
  load(type: ReportType): Promise<Uint8Array>;
}

/** Đọc `report-<type>.xlsx` trong `dir`, giữ trong bộ nhớ sau lần đọc đầu. */
export class FsTemplateStore implements TemplateStore {
  private readonly cache = new Map<ReportType, Promise<Uint8Array>>();

  constructor(private readonly dir: string) {}

  load(type: ReportType): Promise<Uint8Array> {
    let p = this.cache.get(type);
    if (!p) {
      p = readFile(path.join(this.dir, `report-${type}.xlsx`)).then((b) => new Uint8Array(b));
      p.catch(() => this.cache.delete(type)); // lỗi đọc thì lần sau đọc lại
      this.cache.set(type, p);
    }
    return p;
  }
}
