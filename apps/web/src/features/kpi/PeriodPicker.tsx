'use client';

import {
  MAX_RANGE_DAYS,
  isIsoDate,
  previousPeriod,
  quarterPeriod,
  runningMonthPeriod,
  toVnDate,
  weekPeriod,
  type IsoDate,
  type Period,
} from '@ts24-htkh/shared';
import { useState } from 'react';

const PRESETS: { label: string; of: (today: IsoDate) => Period }[] = [
  { label: 'Tuần này', of: weekPeriod },
  { label: 'Tuần trước', of: (t) => previousPeriod(weekPeriod(t)) },
  { label: 'Tháng này', of: runningMonthPeriod },
  { label: 'Tháng trước', of: (t) => previousPeriod(runningMonthPeriod(t)) },
  { label: 'Quý này', of: (t) => quarterPeriod(t) },
  { label: 'Quý trước', of: (t) => quarterPeriod(t, -1) },
];
const DEFAULT_PRESET = 'Tháng này';

/** Kỳ mặc định: tháng TS24 đang chạy theo ngày VN. */
export const defaultPeriod = (): Period => runningMonthPeriod(toVnDate(new Date()));

/** Nút kỳ nhanh + từ ngày – đến ngày. Nhập tay thì bỏ chọn chip. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [preset, setPreset] = useState<string | null>(DEFAULT_PRESET);

  const pick = (p: (typeof PRESETS)[number]) => {
    setPreset(p.label);
    onChange(p.of(toVnDate(new Date())));
  };
  const edit = (key: keyof Period, v: string) => {
    setPreset(null);
    if (isIsoDate(v)) onChange({ ...value, [key]: v });
  };

  return (
    <>
      <div className="chips" role="group" aria-label="Chọn kỳ nhanh">
        {PRESETS.map((p) => (
          <button key={p.label} className="chip" type="button" aria-pressed={preset === p.label} onClick={() => pick(p)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="range">
        <label>
          Từ ngày
          <input className="kin" type="date" value={value.start} onChange={(e) => edit('start', e.target.value)} />
        </label>
        <label>
          Đến ngày
          <input className="kin" type="date" value={value.end} onChange={(e) => edit('end', e.target.value)} />
        </label>
        <p className="range-note">Chọn tay từ ngày – đến ngày thì chip kỳ nhanh bỏ chọn. Tối đa {MAX_RANGE_DAYS} ngày.</p>
      </div>
    </>
  );
}
