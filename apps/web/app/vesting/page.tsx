import { PageHeader, PageContainer } from '@/components/layout';
import { Card, CardContent } from '@/components/ui';

export default function VestingPage() {
  return (
    <div className="min-h-screen bg-bg-page pb-20">
      <PageHeader title="Vesting Schedules" showBack />
      <PageContainer className="py-8">
        <Card>
          <CardContent className="p-8 text-center">
             <h2 className="text-xl font-bold mb-2">Vesting Dashboard</h2>
             <p className="text-text-secondary">Track and manage your token vesting schedules here.</p>
             <div className="mt-8 p-4 bg-bg-elevated rounded-lg inline-block">
               <p className="text-sm text-text-tertiary">No active vesting schedules found.</p>
             </div>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}
