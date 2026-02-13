import { getPortfolioData } from '@/actions/portfolio/get-portfolio-data';
import { PortfolioClientContent } from './PortfolioClientContent';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';

export default async function PortfolioPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  const portfolioData = await getPortfolioData();

  return <PortfolioClientContent data={portfolioData} />;
}
