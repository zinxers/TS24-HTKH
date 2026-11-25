// Cờ "cần xem lại" của đối soát KPI. Chuyển từ HTKH-KPI/app/src/Pure.js (doiSoatFlags), email → userId, TEAMS → teams.
// Chỉ tính các dòng được trả tiền (team có thật, người gửi là nhân viên hoặc đã bị xóa khỏi users).
import { RECONCILE_HIGH, RECONCILE_KENH, RECONCILE_MAX_ITEMS, toVnDate, type ReconcileFlag } from '@ts24-htkh/shared';
import { ratesOn, type ReconcileInput, type ReconcileLine } from './reconcile';

const HIGH_TEXT = RECONCILE_HIGH.join(' / ');
const isHigh = (l: ReconcileLine): boolean => RECONCILE_HIGH.includes(l.kenh);
const isHt = (l: ReconcileLine): boolean => l.kenh.endsWith(' Hoàn Thành');
const ticketKey = (l: ReconcileLine): string => l.ticket.trim().toUpperCase();

function group<T>(rows: T[], keyFn: (r: T) => string | null): { key: string; rows: T[] }[] {
  const g = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyFn(r);
    if (k === null) continue;
    const list = g.get(k);
    if (list) list.push(r);
    else g.set(k, [r]);
  }
  return [...g].map(([key, list]) => ({ key, rows: list }));
}

const dmy = (iso: string): string => iso.split('-').reverse().join('/');

export function reconcileFlags(input: ReconcileInput): ReconcileFlag[] {
  const rate = ratesOn(input.rateVersions, input.range.to);
  const users = new Map(input.users.map((u) => [u.id, u]));
  const teamById = new Map(input.teams.map((t) => [t.id, t]));
  const teamLabel = (id: string | null | undefined): string => {
    const t = id ? teamById.get(id) : undefined;
    return t ? `TEAM ${t.sortOrder}` : '';
  };
  const paid = input.lines.filter((l) => {
    const u = users.get(l.userId);
    return !!l.teamId && teamById.has(l.teamId) && RECONCILE_KENH.includes(l.kenh) && !(u && u.role !== 'staff');
  });
  const firstLine = new Map<string, ReconcileLine>();
  for (const l of paid) if (!firstLine.has(l.userId)) firstLine.set(l.userId, l);

  const out: ReconcileFlag[] = [];
  function flag(rule: ReconcileFlag['rule'], ids: string[], text: string, count: number, rows: ReconcileLine[], team?: string): void {
    const items = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    out.push({
      rule,
      people: ids.map((id) => ({
        userId: id,
        name: users.get(id)?.fullName ?? firstLine.get(id)?.fullName ?? id,
        team: team ?? (teamLabel(users.get(id)?.teamId) || teamLabel(firstLine.get(id)?.teamId)),
      })),
      text,
      count,
      money: rows.reduce((s, l) => s + rate[l.kenh], 0),
      items: items.slice(0, RECONCILE_MAX_ITEMS).map((l) => ({ at: l.createdAt, ticket: l.ticket, kenh: l.kenh, name: l.fullName })),
      more: Math.max(0, items.length - RECONCILE_MAX_ITEMS),
    });
  }

  // QT1: theo từng khối team
  for (const team of [...input.teams].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const rows = paid.filter((l) => l.teamId === team.id);
    const teamHigh = rows.filter(isHigh).length;
    if (!teamHigh) continue;
    const teamRate = teamHigh / rows.length;
    for (const p of group(rows, (l) => l.userId)) {
      const high = p.rows.filter(isHigh);
      if (p.rows.length < 10 || !high.length || high.length * rows.length < 2 * teamHigh * p.rows.length) continue;
      const pct = Math.round((high.length / p.rows.length) * 100);
      const x = (high.length / p.rows.length / teamRate).toFixed(1).replace('.', ',');
      flag(1, [p.key], `${pct}% ${HIGH_TEXT}, team ${Math.round(teamRate * 100)}% (${x} lần) · ${p.rows.length} dòng`, p.rows.length, high, teamLabel(team.id));
    }
  }

  for (const p of group(paid, (l) => l.userId)) {
    // QT2: >= 20 dòng giá cao trong một ngày VN
    for (const d of group(p.rows.filter(isHigh), (l) => toVnDate(new Date(l.createdAt)))) {
      if (d.rows.length >= 20) flag(2, [p.key], `${dmy(d.key)}: ${d.rows.length} dòng ${HIGH_TEXT}`, d.rows.length, d.rows);
    }
    // QT3: một ticket ghi từ >= 2 kênh Hoàn Thành
    const bad = group(p.rows.filter(isHt), (l) => ticketKey(l) || null).filter((t) => group(t.rows, (l) => l.kenh).length >= 2);
    if (bad.length) {
      const rows3 = bad.flatMap((t) => t.rows);
      flag(3, [p.key], `${bad.length === 1 ? bad[0]!.key : `${bad.length} ticket`} ghi từ 2 kênh Hoàn Thành`, rows3.length, rows3);
    }
  }

  // QT4: một ticket + kênh trả cho >= 2 người; một cờ cho mỗi tập người
  const sets = new Map<string, { ids: string[]; groups: { key: string; rows: ReconcileLine[] }[] }>();
  for (const g of group(paid, (l) => (ticketKey(l) ? `${ticketKey(l)}\n${l.kenh}` : null))) {
    const ids = group(g.rows, (l) => l.userId).map((p) => p.key).sort();
    if (ids.length < 2) continue;
    const k = ids.join('\n');
    const s = sets.get(k) ?? { ids, groups: [] };
    s.groups.push(g);
    sets.set(k, s);
  }
  for (const s of sets.values()) {
    const rows4 = s.groups.flatMap((g) => g.rows);
    const [ticket, kenh] = s.groups[0]!.key.split('\n');
    const nTickets = new Set(s.groups.map((g) => g.key.split('\n')[0])).size;
    const text =
      s.groups.length === 1
        ? `${ticket} · ${kenh}`
        : nTickets === 1
          ? `${ticket} ở ${s.groups.length} kênh do ${s.ids.length} người tính`
          : `${nTickets} ticket cùng kênh do ${s.ids.length} người tính`;
    flag(4, s.ids, text, rows4.length, rows4);
  }

  return out
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f.rule - b.f.rule || b.f.money - a.f.money || a.f.people[0]!.name.localeCompare(b.f.people[0]!.name, 'vi') || a.i - b.i)
    .map((x) => x.f);
}
