import { getUserWallets } from '@/lib/data/profile';
import { WalletManagementClient } from './WalletManagementClient';
import { redirect } from 'next/navigation';

export default async function WalletManagementPage() {
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  const wallets = await getUserWallets();

  return <WalletManagementClient initialWallets={wallets} />;
}
