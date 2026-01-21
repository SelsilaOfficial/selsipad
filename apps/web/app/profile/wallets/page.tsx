import { getUserWallets } from '@/lib/data/profile';
import { WalletManagementClient } from './WalletManagementClient';
import { redirect } from 'next/navigation';

export default async function WalletManagementPage() {
  import { getServerSession } from '@/lib/auth/session';
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  const wallets = await getUserWallets();

  return <WalletManagementClient initialWallets={wallets} />;
}
