import { getServerSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { hasDevBadge } from '@/lib/auth/devAccess';
import { AMASubmitForm } from '@/components/ama/AMASubmitForm';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, FolderX, Mic2, Info } from 'lucide-react';

export default async function AMASubmitPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  // ============================================
  // DEVELOPER ACCESS CONTROL
  // ============================================

  const hasAccess = await hasDevBadge(session.userId);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black text-white dark relative overflow-hidden">
        <AnimatedBackground />
        <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />
        <div className="relative z-10">
          <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
            <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center gap-3">
                <Link
                  href="/ama"
                  className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
                </Link>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold">Submit AMA</h1>
                  <p className="text-xs text-gray-400">Request a session</p>
                </div>
              </div>
            </div>
          </header>

          <main className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
            <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-red-500/30 p-8 sm:p-12 shadow-xl shadow-red-500/10 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-red-400" />
              </div>

              <h2 className="text-2xl font-bold mb-2">Developer Verification Required</h2>
              <p className="text-gray-400 mb-6">
                Only verified developers can host AMA sessions. Please complete developer KYC
                verification to continue.
              </p>

              <div className="bg-[#39AEC4]/10 border border-[#39AEC4]/30 rounded-[14px] p-4 mb-6 text-left">
                <p className="text-sm text-gray-300">
                  <strong className="text-[#39AEC4]">Why verification?</strong> This helps protect
                  our community and ensures AMAs are hosted by legitimate project developers.
                </p>
              </div>

              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  href="/profile/kyc/submit"
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/30 font-semibold text-sm"
                >
                  Complete KYC Verification
                </Link>
                <Link
                  href="/ama"
                  className="px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-semibold text-sm"
                >
                  Back to AMAs
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ============================================
  // END DEVELOPER ACCESS CONTROL
  // ============================================

  const supabase = createClient();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('owner_user_id', session.userId)
    .order('created_at', { ascending: false });

  if (!projects || projects.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white dark relative overflow-hidden">
        <AnimatedBackground />
        <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />
        <div className="relative z-10">
          <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
            <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center gap-3">
                <Link
                  href="/ama"
                  className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
                </Link>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold">Submit AMA</h1>
                  <p className="text-xs text-gray-400">Request a session</p>
                </div>
              </div>
            </div>
          </header>

          <main className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
            <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-8 sm:p-12 shadow-xl shadow-[#756BBA]/10 text-center">
              <div className="w-16 h-16 rounded-full bg-[#756BBA]/20 border border-[#756BBA]/30 flex items-center justify-center mx-auto mb-4">
                <FolderX className="w-8 h-8 text-[#756BBA]" />
              </div>
              <h2 className="text-2xl font-bold mb-2">No Projects Found</h2>
              <p className="text-gray-400 mb-6">
                You need to create a project before hosting an AMA
              </p>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/30 font-semibold"
              >
                Create Project
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white dark relative overflow-hidden">
      <AnimatedBackground />
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <Link
                href="/ama"
                className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">Request AMA</h1>
                <p className="text-xs text-gray-400">Submit your session</p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 max-w-2xl">
          {/* Main Form */}
          <AMASubmitForm userProjects={projects} isDevVerified={true} />

          {/* Info Card */}
          <div className="mt-6 rounded-[20px] bg-gradient-to-br from-[#39AEC4]/10 to-[#756BBA]/10 backdrop-blur-xl border border-[#39AEC4]/30 p-5 sm:p-6 shadow-xl shadow-[#756BBA]/20">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-[#39AEC4]" />
              <h3 className="font-bold text-sm sm:text-base">Important Notes</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-[#39AEC4] mt-0.5">•</span>
                AMAs require $100 USD payment (paid in BNB)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#39AEC4] mt-0.5">•</span>
                Price calculated via Chainlink oracle
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#39AEC4] mt-0.5">•</span>
                AMAs require admin approval before going live
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#39AEC4] mt-0.5">•</span>
                Rejected requests get full refund
              </li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
