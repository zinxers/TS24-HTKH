/** Số nguyên dạng 1.234.567 (không phụ thuộc ICU của máy). */
export const fmtNumber = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/** 2026-11-19 → 19/11/2026. */
export const fmtDate = (iso: string) => iso.split('-').reverse().join('/');
