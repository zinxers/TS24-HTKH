'use client';

import type { Period, Team } from '@ts24-htkh/shared';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';
import { KpiShell, useKpiUser } from '../kpi/KpiShell';
import { PeriodPicker, defaultPeriod } from '../kpi/PeriodPicker';
import { DeptOverviewPanel } from './DeptOverviewPanel';
import { TeamTable } from './TeamTable';

const DEPT = 'dept';

/**
 * Trang /team. Trưởng phòng: tab mọi team + "Tổng quan phòng". Người khác: thẳng team mình, không có tab.
 * Ẩn/hiện chỉ là gợi ý; API kiểm quyền (Nhân viên nhận 403 và thấy thông báo).
 */
export function TeamKpiScreen() {
  const { me, notice, setNotice } = useKpiUser();
  const [range, setRange] = useState<Period>(defaultPeriod);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isHead = me?.role === 'head';

  useEffect(() => {
    if (!isHead) return;
    apiClient.teams.list().then(
      (list) => {
        setTeams(list);
        setTab((t) => t ?? list[0]?.id ?? DEPT);
      },
      (e: unknown) => setError(errorMessage(e)),
    );
  }, [isHead]);

  const teamId = isHead ? (tab === DEPT ? null : tab) : (me?.teamId ?? null);

  return (
    <KpiShell me={me} notice={notice} onNotice={setNotice}>
      <h1>KPI theo team</h1>

      {isHead && teams.length > 0 && (
        <div className="tabs" role="tablist" aria-label="Chọn team">
          {[...teams.map((t) => ({ id: t.id, label: t.shortName, title: t.name })), { id: DEPT, label: 'Tổng quan phòng', title: undefined }].map(
            (t) => (
              <button
                key={t.id}
                className={t.id === DEPT ? 'chip dept' : 'chip'}
                type="button"
                role="tab"
                title={t.title}
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ),
          )}
        </div>
      )}

      <PeriodPicker value={range} onChange={setRange} />

      {error && (
        <p role="alert" className="banner-error">
          {error}
        </p>
      )}
      {me && !isHead && !me.teamId && (
        <p role="alert" className="banner-error">
          Bạn không có quyền xem báo cáo team
        </p>
      )}
      {isHead && tab === DEPT && <DeptOverviewPanel range={range} />}
      {teamId && <TeamTable key={teamId} teamId={teamId} range={range} />}
    </KpiShell>
  );
}
