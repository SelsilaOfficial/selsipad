import Link from 'next/link';
import { ArrowLeft, CheckCircle, Clock, XCircle } from 'lucide-react';
import { getPendingAuditProofs } from '../actions';
import { AuditProofCard } from './AuditProofCard';

export default async function AuditProofsPage() {
  const proofsResult = await getPendingAuditProofs();
  const proofs = proofsResult.success ? proofsResult.data : [];

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {/* Back Button */}
      <Link
        href="/admin/contracts"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Contract Management
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <h1 className="text-3xl font-bold text-white">Audit Proof Verification</h1>
        </div>
        <p className="text-gray-400">Review and verify professional security audit submissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-sm text-gray-400">Pending Verification</p>
              <p className="text-2xl font-bold text-white">{proofs?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 bg-green-950/30 border border-green-800/40 rounded-lg p-4">
        <div className="flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-green-300 font-medium mb-1">SECURITY_AUDITED Badge</p>
            <p className="text-green-200/80">
              Verifying an audit proof will automatically issue the SECURITY_AUDITED badge to the
              project. This badge indicates professional third-party security review.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Proofs List */}
      {proofs && proofs.length > 0 ? (
        <div className="space-y-4">
          {proofs.map((proof: any) => (
            <AuditProofCard key={proof.id} proof={proof} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
          <CheckCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No Pending Audit Proofs</h3>
          <p className="text-gray-500 text-sm">
            All audit submissions have been processed. New submissions will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
