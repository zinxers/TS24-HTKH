import type { Metadata } from 'next';
import { RatesPanel } from '../../../../features/kpi/RatesPanel';

export const metadata: Metadata = { title: 'Đơn giá KPI · TS24-HTKH' };

export default function RatesPage() {
  return <RatesPanel />;
}
