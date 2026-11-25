import type { Metadata } from 'next';
import { ReportsScreen } from '../../../features/reports/ReportsScreen';

export const metadata: Metadata = { title: 'Báo cáo tổng hợp · TS24-HTKH' };

export default function ReportsPage() {
  return <ReportsScreen />;
}
