import type { Metadata } from 'next';
import { TeamKpiScreen } from '../../../../features/team/TeamKpiScreen';

export const metadata: Metadata = { title: 'KPI theo team · TS24-HTKH' };

export default function TeamKpiPage() {
  return <TeamKpiScreen />;
}
