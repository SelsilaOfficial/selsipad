import { getUserProfile } from '@/lib/data/profile';
import BlueCheckClientContent from './BlueCheckClientContent';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BlueCheckStatusPage() {
  const profile = await getUserProfile();

  return <BlueCheckClientContent bluecheckStatus={profile?.bluecheck_status || 'none'} />;
}
