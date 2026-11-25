import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { IsoDate, ReportType } from '@ts24-htkh/shared';
import { fillSheetXml, growRowHeights, type Cells } from './sheet-xml';

const SHEET = 'xl/worksheets/sheet1.xml';

/** Điền `cells` vào mẫu xlsx; chỉ sửa sheet1.xml, mọi file khác trong zip giữ nguyên byte. */
export function fillReport(template: Uint8Array, type: ReportType, cells: Cells): Uint8Array {
  const files = unzipSync(template);
  const sheet = files[SHEET];
  if (!sheet) throw new Error(`Không thấy ${SHEET} trong file mẫu`);
  files[SHEET] = strToU8(growRowHeights(fillSheetXml(strFromU8(sheet), cells), cells, type));
  return zipSync(files);
}

/** TYPE-TEC-yyMMdd.xlsx, yyMMdd = ngày xuất. */
export function reportFileName(type: ReportType, day: IsoDate): string {
  return `${type}-TEC-${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}.xlsx`;
}
