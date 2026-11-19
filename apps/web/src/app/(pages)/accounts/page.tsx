import type { Metadata } from 'next';
import { AccountsScreen } from '../../../features/accounts/AccountsScreen';

export const metadata: Metadata = { title: 'Quản lý tài khoản · TS24-HTKH' };

export default function AccountsPage() {
  return <AccountsScreen />;
}
