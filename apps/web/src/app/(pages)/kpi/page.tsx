import type { Metadata } from 'next';
import { KpiEntryScreen } from '../../../features/kpi/KpiEntryScreen';

export const metadata: Metadata = { title: 'Nhập KPI · TS24-HTKH' };

export default function KpiPage() {
  return <KpiEntryScreen />;
}
