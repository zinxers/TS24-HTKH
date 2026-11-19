'use client';

import type { KpiRowResult } from '@ts24-htkh/shared';
import { useEffect, useState } from 'react';

/** Dòng nháp: các ô là chuỗi thô ('' = chưa chọn); `errors` theo field từ lần gửi gần nhất. */
export interface DraftRow {
  rowId: string;
  ticket: string;
  kenh: string;
  phanLoai: string;
  noiDung: string;
  errors: Record<string, string>;
}

type Editable = Partial<Pick<DraftRow, 'ticket' | 'kenh' | 'phanLoai' | 'noiDung'>>;

/** Phần gửi lên API / lưu máy: bỏ `errors`. */
export const toInput = ({ rowId, ticket, kenh, phanLoai, noiDung }: DraftRow) => ({ rowId, ticket, kenh, phanLoai, noiDung });

const keyOf = (userId: string) => `ts24-htkh:kpi-draft:${userId}`;

function load(userId: string): DraftRow[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(keyOf(userId)) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return (parsed as DraftRow[]).filter((r) => typeof r?.rowId === 'string').map((r) => ({
      rowId: r.rowId,
      ticket: r.ticket ?? '',
      kenh: r.kenh ?? '',
      phanLoai: r.phanLoai ?? '',
      noiDung: r.noiDung ?? '',
      errors: {},
    }));
  } catch {
    return [];
  }
}

/** Nháp nhập KPI tự lưu ở localStorage theo người dùng; localStorage hỏng thì vẫn dùng được trong phiên. */
export function useKpiDraft(userId: string) {
  const [rows, setRows] = useState<DraftRow[]>(() => load(userId));

  useEffect(() => {
    try {
      localStorage.setItem(keyOf(userId), JSON.stringify(rows.map(toInput)));
    } catch {
      /* không lưu được thì thôi */
    }
  }, [userId, rows]);

  return {
    rows,
    addRow: () =>
      setRows((rs) => [...rs, { rowId: crypto.randomUUID(), ticket: '', kenh: '', phanLoai: '', noiDung: '', errors: {} }]),
    updateRow: (rowId: string, patch: Editable) =>
      setRows((rs) =>
        rs.map((r) => {
          if (r.rowId !== rowId) return r;
          const errors = { ...r.errors };
          for (const field of Object.keys(patch)) delete errors[field];
          return { ...r, ...patch, errors };
        }),
      ),
    removeRow: (rowId: string) => setRows((rs) => rs.filter((r) => r.rowId !== rowId)),
    /** Bỏ dòng đã ghi nhận; dòng lỗi ở lại kèm lỗi theo field (lỗi đầu tiên của mỗi field). */
    applyResults: (results: KpiRowResult[]) =>
      setRows((rs) =>
        rs.flatMap((r) => {
          const res = results.find((x) => x.rowId === r.rowId);
          if (!res) return [r];
          if (res.status === 'ok') return [];
          const errors: Record<string, string> = {};
          for (const e of res.errors) errors[e.field] ??= e.message;
          return [{ ...r, errors }];
        }),
      ),
  };
}
