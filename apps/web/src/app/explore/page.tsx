import Link from 'next/link';
import {
  Card,
  CardContent,
  StatusBadge,
  ProgressBar,
  EmptyState,
  EmptyIcon,
} from '@/components/ui';
import { PageHeader, PageContainer } from '@/components/layout';
import { getAllProjects, getBondingCurvePools } from '@/lib/data/projects';
import { ExploreClientContent } from './ExploreClientContent';

// Force dynamic rendering - no cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ExplorePage() {
  // Fetch data server-side (parallel)
  const [launchpadProjects, bondingCurveProjects] = await Promise.all([
    getAllProjects(),
    getBondingCurvePools(),
  ]);

  // Merge all projects
  const initialProjects = [...launchpadProjects, ...bondingCurveProjects];

  return <ExploreClientContent initialProjects={initialProjects} />;
}
