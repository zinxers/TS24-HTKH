import type { ReactElement } from 'react';

// Minh hoạ ô trang chủ: màu theo token logo nên tự đổi sáng/tối; class m/grow/lift/... là chuyển động khi rê chuột (home.css).
const NAVY = 'var(--logo-shield-l)';
const TEAL = 'var(--logo-shield-r)';
const SOFT = 'var(--fill-strong)';
const BG = 'var(--bg)';

export type HomeArtKey = 'kpi' | 'mine' | 'rates' | 'team' | 'reports' | 'accounts';

export const HOME_ART: Record<HomeArtKey, ReactElement> = {
  kpi: (
    <svg viewBox="0 0 360 200">
      <rect x="70" y="20" width="220" height="190" rx="18" fill={SOFT} />
      <rect x="86" y="36" width="188" height="174" rx="12" fill={BG} />
      <rect x="146" y="10" width="68" height="22" rx="8" fill={NAVY} />
      <g strokeWidth="10" strokeLinecap="round" fill="none">
        <path d="M110 72 H250 M110 104 H250 M110 136 H250 M110 168 H250" stroke={SOFT} />
        <path className="write" d="M110 72 H220" stroke={TEAL} />
        <path className="write d2" d="M110 104 H190" stroke={TEAL} />
        <path className="write d3" d="M110 136 H236" stroke={TEAL} />
      </g>
      <g className="m lift">
        <rect x="262" y="70" width="22" height="110" rx="6" transform="rotate(28 273 125)" fill={NAVY} />
      </g>
    </svg>
  ),
  mine: (
    <svg viewBox="0 0 300 200">
      <path d="M30 186 H270" stroke="var(--separator)" strokeWidth="4" strokeLinecap="round" />
      <rect className="m grow" x="50" y="120" width="36" height="64" rx="8" fill={SOFT} />
      <rect className="m grow d1" x="104" y="92" width="36" height="92" rx="8" fill={SOFT} />
      <rect className="m grow d2" x="158" y="70" width="36" height="114" rx="8" fill={NAVY} />
      <rect className="m grow d3" x="212" y="40" width="36" height="144" rx="8" fill={TEAL} />
    </svg>
  ),
  rates: (
    <svg viewBox="0 0 300 200">
      <rect x="40" y="60" width="190" height="130" rx="14" fill={SOFT} />
      <g fill={BG}>
        <rect x="56" y="78" width="70" height="20" rx="5" />
        <rect x="138" y="78" width="76" height="20" rx="5" />
        <rect x="56" y="110" width="70" height="20" rx="5" />
        <rect x="138" y="110" width="76" height="20" rx="5" />
        <rect x="56" y="142" width="70" height="20" rx="5" />
        <rect x="138" y="142" width="76" height="20" rx="5" />
      </g>
      <g className="m swing">
        <path
          d="M196 22 h66 a8 8 0 0 1 8 8 v50 l-41 41 -41 -41 v-50 a8 8 0 0 1 8 -8z"
          fill={TEAL}
          transform="rotate(12 230 60)"
        />
        <circle cx="240" cy="42" r="8" fill={BG} />
      </g>
    </svg>
  ),
  team: (
    <svg viewBox="0 0 300 200">
      <g className="m bob">
        <circle cx="80" cy="70" r="26" fill={NAVY} />
        <rect x="48" y="104" width="64" height="80" rx="30" fill={NAVY} />
      </g>
      <g className="m bob d1">
        <circle cx="150" cy="56" r="30" fill={TEAL} />
        <rect x="113" y="96" width="74" height="88" rx="34" fill={TEAL} />
      </g>
      <g className="m bob d2">
        <circle cx="220" cy="70" r="26" fill={SOFT} />
        <rect x="188" y="104" width="64" height="80" rx="30" fill={SOFT} />
      </g>
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 300 200">
      <rect x="74" y="64" width="150" height="130" rx="14" fill={SOFT} transform="rotate(-6 150 130)" />
      <rect x="80" y="54" width="150" height="140" rx="14" fill={SOFT} />
      <g className="m lift">
        <rect x="90" y="40" width="150" height="150" rx="14" fill={NAVY} />
        <g fill={TEAL}>
          <rect x="108" y="62" width="50" height="14" rx="4" />
          <rect x="108" y="88" width="114" height="10" rx="4" opacity=".55" />
          <rect x="108" y="108" width="114" height="10" rx="4" opacity=".55" />
          <rect x="108" y="128" width="80" height="10" rx="4" opacity=".55" />
        </g>
        <rect x="178" y="150" width="48" height="26" rx="6" fill={TEAL} />
      </g>
    </svg>
  ),
  accounts: (
    <svg viewBox="0 0 360 210">
      <rect x="30" y="40" width="230" height="140" rx="18" fill={SOFT} />
      <circle cx="92" cy="98" r="28" fill={NAVY} />
      <rect x="60" y="132" width="64" height="30" rx="14" fill={NAVY} />
      <g fill={BG}>
        <rect x="140" y="80" width="96" height="14" rx="5" />
        <rect x="140" y="106" width="70" height="12" rx="5" />
        <rect x="140" y="128" width="84" height="12" rx="5" />
      </g>
      <g className="m spin" fill={TEAL}>
        <rect x="282" y="104" width="16" height="16" rx="3" />
        <rect x="282" y="180" width="16" height="16" rx="3" />
        <rect x="244" y="142" width="16" height="16" rx="3" />
        <rect x="320" y="142" width="16" height="16" rx="3" />
        <circle cx="290" cy="150" r="34" />
        <circle cx="290" cy="150" r="12" fill="var(--group)" />
      </g>
    </svg>
  ),
};
