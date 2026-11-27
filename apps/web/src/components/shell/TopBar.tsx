import Link from 'next/link';
import { tsWeekNumber, weekPeriod, type IsoDate } from '@ts24-htkh/shared';
import { ThemeMenu } from '../ThemeMenu';

interface TopBarProps {
  today: IsoDate;
  onMenu?: () => void; // có: hiện nút ☰ (ngăn kéo dưới 768px)
  menuOpen?: boolean;
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function TopBar({ today, onMenu, menuOpen }: TopBarProps) {
  const p = weekPeriod(today);
  return (
    <header className="appbar">
      {onMenu && (
        <button type="button" className="ibtn menu-btn" onClick={onMenu} aria-label="Mở menu" aria-expanded={menuOpen ?? false}>
          <svg className="i" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      )}
      <div className="pill ky" title="Kỳ TS24 hiện tại">
        <span>{`Tuần ${tsWeekNumber(p.start)} · ${dm(p.start)}–${dm(p.end)}`}</span>
      </div>
      <span className="grow" />
      <ThemeMenu />
      <Link href="/kpi" className="pill plus" aria-label="Nhập KPI">+</Link>
    </header>
  );
}
