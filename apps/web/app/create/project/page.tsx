import Link from 'next/link';
import { Card, CardContent } from '@/components/ui';
import { PageHeader, PageContainer } from '@/components/layout';

export default function CreateProjectPage() {
  return (
    <div className="min-h-screen bg-bg-page pb-20">
      <PageHeader title="Create Project" showBack />

      <PageContainer className="py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-heading-xl font-bold text-text-primary mb-2">
              Launch Your Token
            </h1>
            <p className="text-body-md text-text-secondary">
              Choose the launch method that fits your project goals
            </p>
          </div>

          {/* Options Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Presale */}
            <Link href="/create/presale">
              <Card hover className="h-full">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                    <svg
                      className="w-8 h-8 text-blue-600 dark:text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                  
                  <h3 className="text-heading-lg font-bold text-center mb-3">Presale</h3>
                  <p className="text-body-sm text-text-secondary text-center mb-4">
                    Traditional token presale with hardcap and softcap targets
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-text-secondary">Set hardcap & softcap</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-text-secondary">Auto liquidity lock</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-text-secondary">Team vesting</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-border-subtle">
                    <div className="flex items-center justify-center gap-2 text-primary-main font-semibold">
                      <span>Start Presale</span>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Fairlaunch */}
            <Link href="/create/fairlaunch">
              <Card hover className="h-full">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                    <svg
                      className="w-8 h-8 text-emerald-600 dark:text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                  </div>
                  
                  <h3 className="text-heading-lg font-bold text-center mb-3">Fairlaunch</h3>
                  <p className="text-body-sm text-text-secondary text-center mb-4">
                    No hardcap - everyone gets the same price based on total raised
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-text-secondary">Fair price discovery</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-text-secondary">No contribution limits</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-text-secondary">Team vesting</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-border-subtle">
                    <div className="flex items-center justify-center gap-2 text-primary-main font-semibold">
                      <span>Start Fairlaunch</span>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Bonding Curve */}
            <Link href="/create/bonding-curve">
              <Card hover className="h-full">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                    <svg
                      className="w-8 h-8 text-cyan-600 dark:text-cyan-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                  
                  <h3 className="text-heading-lg font-bold text-center mb-3">Bonding Curve</h3>
                  <p className="text-body-sm text-text-secondary text-center mb-4">
                    Permissionless Solana launch with automatic price discovery
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-text-secondary">Instant liquidity</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-text-secondary">Auto graduation to DEX</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-text-secondary">No KYC required</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-border-subtle">
                    <div className="flex items-center justify-center gap-2 text-primary-main font-semibold">
                      <span>Start Bonding Curve</span>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Info Section */}
          <div className="mt-12 bg-bg-elevated border border-border-subtle rounded-2xl p-6">
            <h3 className="text-heading-md font-bold mb-4">Need Help Choosing?</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold text-text-primary mb-2">Choose Presale if:</h4>
                <ul className="space-y-1 text-text-secondary">
                  <li>• You have specific funding goals</li>
                  <li>• You want contribution limits</li>
                  <li>• You need traditional structure</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-text-primary mb-2">Choose Fairlaunch if:</h4>
                <ul className="space-y-1 text-text-secondary">
                  <li>• You want fair price discovery</li>
                  <li>• You prefer no contribution caps</li>
                  <li>• Community decides the price</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-text-primary mb-2">Choose Bonding Curve if:</h4>
                <ul className="space-y-1 text-text-secondary">
                  <li>• You want instant liquidity</li>
                  <li>• You're launching on Solana</li>
                  <li>• You want permissionless launch</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
