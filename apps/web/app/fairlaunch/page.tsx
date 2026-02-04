import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Fairlaunch | SELSIPAD',
  description: 'Browse and participate in fair launch token sales',
};

export default async function FairlaunchPage() {
  // Redirect to Explore page since fairlaunch list is now integrated there
  redirect('/explore');
}
