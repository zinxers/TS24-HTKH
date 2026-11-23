'use client';

import { DEPT_SCOPE, reportFieldsFor, reportPeriods, toVnDate, type ReportPreview, type ReportType } from '@ts24-htkh/shared';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ApiError, apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';
import { useConfirmAction } from '../accounts/useConfirmAction';
import { KpiShell, fmtDate, useKpiUser } from '../kpi/KpiShell';
import { NotesForm } from './NotesForm';
import { ReportTable } from './ReportTable';

const TYPES: { type: ReportType; label: string }[] = [
  { type: 'WR', label: 'Tuần (WR)' },
  { type: 'MR', label: 'Tháng (MR)' },
  { type: 'QR', label: 'Quý (QR)' },
];
const CONFLICT = 'Nội dung vừa được người khác sửa, vui lòng tải lại';
const PANEL = 'report-scope-panel';

/**
 * Trang /reports. Trưởng phòng: 3 cột team + chữ 4 phạm vi (Cả phòng, từng team). Quản lý: chỉ team mình.
 * Ẩn/hiện chỉ là gợi ý; API kiểm quyền.
 */
export function ReportsScreen() {
  const { me, notice, setNotice, leave } = useKpiUser();
  const today = useMemo(() => toVnDate(new Date()), []);
  const [type, setType] = useState<ReportType>('WR');
  const [start, setStart] = useState(() => reportPeriods('WR', today)[1]!.start);
  const [scope, setScope] = useState<string>(DEPT_SCOPE);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Chỉ các ô người dùng đã gõ của phạm vi hiện tại; ô khác lấy bản đã lưu mới nhất (sau 409 vẫn đúng).
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const allowDownload = useRef(false);
  const actions = useConfirmAction(() => void leave());

  const isHead = me?.role === 'head';
  const curScope = isHead ? scope : (me?.teamId ?? null);
  const periods = useMemo(() => reportPeriods(type, today), [type, today]);
  const period = periods.find((p) => p.start === start) ?? periods[1]!;

  useEffect(() => {
    if (!me) return;
    let stale = false;
    setLoadError(null);
    apiClient.reports.preview(type, start).then(
      (p) => !stale && setPreview(p),
      (e: unknown) => {
        if (stale) return;
        if (e instanceof ApiError && e.status === 401) void leave();
        else {
          setPreview(null);
          setLoadError(errorMessage(e));
        }
      },
    );
    return () => {
      stale = true;
    };
  }, [me, type, start, reloadKey, leave]);

  const meta = preview?.notes.scopes.find((s) => s.scope === curScope);
  const saved = meta?.fields ?? {};
  const values = { ...saved, ...draft };
  const dirty = Object.entries(draft ?? {}).some(([k, v]) => v.trim() !== (saved[k] ?? '').trim());
  const teams = preview?.teams.filter((t) => t !== null) ?? [];
  const scopeName = (s: string) => (s === DEPT_SCOPE ? 'Cả phòng' : (teams.find((t) => t.id === s)?.shortName ?? ''));

  /** Có chữ chưa lưu thì hỏi trước khi bỏ. */
  const guard = (change: () => void) => {
    const fn = () => {
      actions.setError(null);
      setDraft(null);
      change();
    };
    if (!dirty) return fn();
    actions.ask({
      title: 'Bỏ nội dung chưa lưu?',
      message: 'Nội dung chữ vừa gõ chưa được lưu sẽ mất.',
      confirmLabel: 'Bỏ nội dung',
      danger: true,
      run: async () => fn(),
    });
  };
  const pickType = (t: ReportType) =>
    t !== type &&
    guard(() => {
      setPreview(null);
      setType(t);
      setStart(reportPeriods(t, today)[1]!.start);
    });
  const pickStart = (s: string) =>
    guard(() => {
      setPreview(null);
      setStart(s as typeof start);
    });
  const pickScope = (s: string) => s !== scope && guard(() => setScope(s));

  const save = () => {
    if (!dirty || !curScope) return;
    const input = { start, scope: curScope, fields: values, expectedVersion: meta?.version ?? null };
    actions.ask({
      title: 'Lưu nội dung chữ?',
      message: `Lưu nội dung chữ ${scopeName(curScope)} của ${period.label}.`,
      confirmLabel: 'Lưu',
      run: async () => {
        try {
          const notes = await apiClient.reports.saveNotes(type, input);
          setPreview((p) => p && { ...p, notes });
          setDraft(null);
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 409)) throw e;
          // Giữ bản đang gõ để người dùng chép lại; tải lại để biết version mới.
          actions.setError(CONFLICT);
          setReloadKey((k) => k + 1);
        }
      },
    });
  };

  const onDownload = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!dirty || allowDownload.current) return;
    e.preventDefault();
    actions.ask({
      title: 'Tải file khi chưa lưu?',
      message: 'File dùng nội dung chữ đã lưu; phần vừa gõ chưa lưu sẽ không có trong file.',
      confirmLabel: 'Tải file',
      run: async () => {
        allowDownload.current = true;
        link.current?.click();
        allowDownload.current = false;
      },
    });
  };

  const tabs = [DEPT_SCOPE, ...teams.map((t) => t.id)];
  const showTabs = isHead && teams.length > 0;

  // Mẫu tablist WAI-ARIA như /team: ←/→ vòng quanh, Home/End.
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.indexOf(scope);
    const next = ({ ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 } as Record<string, number>)[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = tabs[(next + tabs.length) % tabs.length]!;
    pickScope(id);
    if (!dirty) document.getElementById(`scope-${id}`)?.focus();
  };

  const fileName = `${type}-TEC-${today.slice(2, 4)}${today.slice(5, 7)}${today.slice(8, 10)}.xlsx`;
  const form = curScope && preview && (
    <NotesForm
      key={`${type}-${curScope}`}
      type={type}
      fields={reportFieldsFor(type, curScope)}
      values={values}
      meta={meta}
      dirty={dirty}
      busy={actions.busy}
      onChange={(k, v) =>
        setDraft((d) => {
          // Trả về như bản đã lưu thì bỏ key, để bản mới của người khác (sau 409) không bị ghi đè.
          const next = { ...d, [k]: v };
          if (v.trim() === (saved[k] ?? '').trim()) delete next[k];
          return Object.keys(next).length ? next : null;
        })
      }
      onSave={save}
    />
  );

  return (
    <KpiShell me={me} notice={notice} onNotice={setNotice}>
      <div className="head-row">
        <h1>Báo cáo tổng hợp</h1>
        <span className="muted">{isHead ? 'Cả phòng' : (teams[0]?.shortName ?? '')}</span>
      </div>

      <div className="pick">
        <div className="chips" role="group" aria-label="Loại báo cáo">
          {TYPES.map((t) => (
            <button key={t.type} className="chip" type="button" aria-pressed={type === t.type} onClick={() => pickType(t.type)}>
              {t.label}
            </button>
          ))}
        </div>
        <label>
          Kỳ
          <select className="kin" aria-label="Kỳ" value={period.start} onChange={(e) => pickStart(e.target.value)}>
            {periods.map((p) => (
              <option key={p.start} value={p.start}>
                {p.label}
                {p.running ? ' (đang chạy)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        Từ {fmtDate(period.start)} đến {fmtDate(period.end)}
      </p>

      {me && !isHead && !me.teamId && me.role === 'manager' && (
        <p role="alert" className="banner-error">
          Bạn chưa thuộc team nào
        </p>
      )}
      {loadError && (
        <p role="alert" className="banner-error">
          {loadError}
        </p>
      )}

      {preview && (
        <>
          <ReportTable preview={preview} />

          <div className="dl">
            <a ref={link} className="btn btn-primary" href={apiClient.reports.fileUrl(type, period.start)} download onClick={onDownload}>
              Tải file xlsx
            </a>
            <span className="muted">
              {fileName} · ký {isHead ? 'TP.' : 'PP.'} Hỗ Trợ Khách Hàng · dùng nội dung chữ đã lưu
            </span>
          </div>

          <h2 className="sec-title">Nội dung chữ</h2>
          {showTabs && (
            <div className="tabs" role="tablist" aria-label="Phạm vi" onKeyDown={onTabKey}>
              {tabs.map((id) => (
                <button
                  key={id}
                  id={`scope-${id}`}
                  className={id === DEPT_SCOPE ? 'chip dept' : 'chip'}
                  type="button"
                  role="tab"
                  aria-selected={scope === id}
                  aria-controls={scope === id ? PANEL : undefined}
                  tabIndex={scope === id ? 0 : -1}
                  onClick={() => pickScope(id)}
                >
                  {scopeName(id)}
                </button>
              ))}
            </div>
          )}
          {actions.error && (
            <p role="alert" className="banner-error">
              {actions.error}
            </p>
          )}
          {showTabs ? (
            <div role="tabpanel" id={PANEL} aria-labelledby={`scope-${scope}`}>
              {form}
            </div>
          ) : (
            form
          )}
        </>
      )}

      <ConfirmDialog {...actions.dialogProps} />
    </KpiShell>
  );
}
