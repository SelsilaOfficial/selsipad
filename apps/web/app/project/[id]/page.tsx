import { notFound } from 'next/navigation';
import { Card, CardContent, StatusBadge, ProgressBar, Tabs } from '@/components/ui';
import { PageHeader, PageContainer } from '@/components/layout';
import { getProjectById } from '@/lib/data/projects';
import { ParticipationForm } from '@/components/features/ParticipationForm';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await getProjectById(params.id);

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-bg-page pb-20">
      <PageHeader showBack title={project.name} />

      <PageContainer className="py-4 space-y-6">
        {/* Header Card */}
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-bg-elevated rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                {project.symbol.slice(0, 2)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-heading-lg">{project.name}</h1>
                  <StatusBadge status={project.status} />
                </div>
                <p className="text-body-sm text-text-secondary">{project.description}</p>
              </div>
            </div>

            <ProgressBar
              value={project.raised}
              max={project.target}
              label={`${project.raised}/${project.target} ${project.network} Raised`}
              showPercentage
            />
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs
          tabs={[
            {
              id: 'overview',
              label: 'Overview',
              content: (
                <div className="space-y-4">
                  {/* Key Info */}
                  <Card>
                    <CardContent className="space-y-3">
                      <h3 className="text-heading-md">Key Information</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-caption text-text-secondary">Type</p>
                          <p className="text-body-sm font-semibold capitalize">{project.type}</p>
                        </div>
                        <div>
                          <p className="text-caption text-text-secondary">Network</p>
                          <p className="text-body-sm font-semibold">{project.network}</p>
                        </div>
                        <div>
                          <p className="text-caption text-text-secondary">Raised</p>
                          <p className="text-body-sm font-semibold">
                            {project.raised} {project.network}
                          </p>
                        </div>
                        <div>
                          <p className="text-caption text-text-secondary">Target</p>
                          <p className="text-body-sm font-semibold">
                            {project.target} {project.network}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Description */}
                  <Card>
                    <CardContent className="space-y-2">
                      <h3 className="text-heading-md">About</h3>
                      <p className="text-body-sm text-text-secondary leading-relaxed">
                        {project.description}
                      </p>
                      {/* TODO: Add more description content */}
                    </CardContent>
                  </Card>
                </div>
              ),
            },
            {
              id: 'participation',
              label: 'Participation',
              content: (
                <ParticipationForm
                  projectId={project.id}
                  projectName={project.name}
                  projectSymbol={project.symbol}
                  network={project.network}
                  contractAddress={project.contract_address}
                  minContribution={0.1}
                  maxContribution={10}
                  projectType={project.type}
                />
              ),
            },
            {
              id: 'safety',
              label: 'Safety',
              content: (
                <div className="space-y-4">
                  {/* Trust Snapshot */}
                  <Card
                    variant="bordered"
                    className={project.kyc_verified ? 'border-l-4 border-status-success-text' : ''}
                  >
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{project.kyc_verified ? '✓' : '✗'}</span>
                        <h3 className="text-heading-sm">KYC Verification</h3>
                      </div>
                      <p className="text-caption text-text-secondary">
                        {project.kyc_verified
                          ? 'Tim telah melewati verifikasi KYC'
                          : 'Tim belum verifikasi KYC'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card
                    variant="bordered"
                    className={
                      project.audit_status === 'pass' ? 'border-l-4 border-status-success-text' : ''
                    }
                  >
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {project.audit_status === 'pass' ? '✓' : '⏳'}
                        </span>
                        <h3 className="text-heading-sm">Smart Contract Audit</h3>
                      </div>
                      <p className="text-caption text-text-secondary">
                        {project.audit_status === 'pass'
                          ? 'Kontrak telah di-audit dan aman'
                          : 'Audit sedang dalam proses'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card
                    variant="bordered"
                    className={project.lp_lock ? 'border-l-4 border-status-success-text' : ''}
                  >
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{project.lp_lock ? '🔒' : '-'}</span>
                        <h3 className="text-heading-sm">Liquidity Lock</h3>
                      </div>
                      <p className="text-caption text-text-secondary">
                        {project.lp_lock
                          ? 'Likuiditas akan di-lock pasca launch'
                          : 'Tidak ada LP lock dikonfigurasi'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ),
            },
          ]}
          defaultTab="overview"
        />
      </PageContainer>
    </div>
  );
}
