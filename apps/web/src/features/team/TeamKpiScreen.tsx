'use client';

import type { Period, Team } from '@ts24-htkh/shared';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';
import { useCurrentUser } from '../../lib/current-user';
import { PeriodPicker, defaultPeriod } from '../kpi/PeriodPicker';
import { DeptOverviewPanel } from './DeptOverviewPanel';
import { TeamTable } from './TeamTable';

const DEPT = 'dept';
const PANEL = 'team-tabpanel';

/**
 * Trang /team. Trưởng phòng: tab mọi team + "Tổng quan phòng". Người khác: thẳng team mình, không có tab.
 * Ẩn/hiện chỉ là gợi ý; API kiểm quyền (Nhân viên nhận 403 và thấy thông báo).
 */
export function TeamKpiScreen() {
  const { me } = useCurrentUser();
  const [range, setRange] = useState<Period>(defaultPeriod);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isHead = me.role === 'head';

  useEffect(() => {
    if (!isHead) return;
    let stale = false;
    apiClient.teams.list().then(
      (list) => {
        if (stale) return;
        setTeams(list);
        setTab((t) => t ?? list[0]?.id ?? DEPT);
      },
      (e: unknown) => !stale && setError(errorMessage(e)),
    );
    return () => {
      stale = true;
    };
  }, [isHead]);

  const teamId = isHead ? (tab === DEPT ? null : tab) : (me.teamId ?? null);
  const tabs = [...teams.map((t) => ({ id: t.id, label: t.shortName, title: t.name })), { id: DEPT, label: 'Tổng quan phòng', title: undefined }];
  const showTabs = isHead && teams.length > 0;

  // Mẫu tablist WAI-ARIA: ←/→ vòng quanh, Home/End; chọn ngay khi chuyển focus.
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === tab);
    const next = ({ ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 } as Record<string, number>)[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = tabs[(next + tabs.length) % tabs.length]!.id;
    setTab(id);
    document.getElementById(`tab-${id}`)?.focus();
  };

  const content = (
    <>
      {isHead && tab === DEPT && <DeptOverviewPanel range={range} />}
      {teamId && <TeamTable key={teamId} teamId={teamId} range={range} />}
    </>
  );

  return (
    <>
      <h1>KPI theo team</h1>

      {showTabs && (
        <div className="tabs" role="tablist" aria-label="Chọn team" onKeyDown={onTabKey}>
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              className={t.id === DEPT ? 'chip dept' : 'chip'}
              type="button"
              role="tab"
              title={t.title}
              aria-selected={tab === t.id}
              aria-controls={tab === t.id ? PANEL : undefined}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <PeriodPicker value={range} onChange={setRange} />

      {error && (
        <p role="alert" className="banner-error">
          {error}
        </p>
      )}
      {!isHead && !me.teamId && (
        <p role="alert" className="banner-error">
          Bạn không có quyền xem báo cáo team
        </p>
      )}
      {showTabs ? (
        <div role="tabpanel" id={PANEL} aria-labelledby={`tab-${tab}`} tabIndex={0}>
          {content}
        </div>
      ) : (
        content
      )}
    </>
  );
}
