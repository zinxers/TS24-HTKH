import type { Metadata } from 'next';
import { MyKpiScreen } from '../../../../../features/kpi/MyKpiScreen';

export const metadata: Metadata = { title: 'KPI của tôi · TS24-HTKH' };

export default function MyKpiPage() {
  return <MyKpiScreen />;
}
