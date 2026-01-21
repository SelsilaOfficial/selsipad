import { getServerSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AMASubmitForm } from '@/components/ama/AMASubmitForm';
import { PageHeader, PageContainer } from '@/components/layout';
import { redirect } from 'next/navigation';

export default async function AMASubmitPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  const supabase = createClient();

  // Get user's projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('creator_id', session.userId)
    .order('created_at', { ascending: false });

  if (!projects || projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <PageHeader title="Submit AMA" backUrl="/ama" />
        <PageContainer className="py-12">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Projects Found</h2>
            <p className="text-gray-600 mb-6">You need to create a project before hosting an AMA</p>
            <a
              href="/explore"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Explore Projects
            </a>
          </div>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Submit AMA" backUrl="/ama" />

      <PageContainer className="py-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create AMA Session</h2>
            <p className="text-gray-600 mb-6">Host a live Q&A session with your community</p>

            <AMASubmitForm userProjects={projects} />
          </div>

          {/* Info Card */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-2">📌 Important Notes</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• AMAs require admin approval before going live</li>
              <li>• Schedule at least 24 hours in advance</li>
              <li>• TEXT AMAs are free, VOICE/VIDEO may require payment</li>
              <li>• You can edit or cancel before approval</li>
            </ul>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
