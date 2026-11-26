import type { ReactNode } from 'react';
import type { NavIcon } from './nav';

const PATHS: Record<NavIcon, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5" />,
  kpi: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  mine: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  rates: <path d="M12 3v18M16 7.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.5 4 2.5 4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5" />,
  team: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9.2a3 3 0 0 0 0-5.6M21 20a5 5 0 0 0-4-4.9" />,
  reports: <path d="M6 3h9l4 4v14H6V3Zm8 0v5h5M9 13h7M9 17h7" />,
  accounts: <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Zm-3 9 2 2 4-4" />,
};

/** Icon 20px, nét 1.75, currentColor; trang trí nên ẩn khỏi trình đọc màn hình. */
export function NavGlyph({ name }: { name: NavIcon }) {
  return (
    <svg
      className="i"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
