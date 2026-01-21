import { getUserWallets } from '@/lib/data/profile';
import { WalletManagementClient } from './WalletManagementClient';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';

export default async function WalletManagementPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  const wallets = await getUserWallets();

  return <WalletManagementClient initialWallets={wallets} />;
}
