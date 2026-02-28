import type { PoolStatus } from '@selsipad/shared';

interface StatusPillProps {
  status: PoolStatus | string;
}

export function StatusPill({ status }: StatusPillProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return {
          label: 'Draft',
          color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        };
      case 'SUBMITTED':
        return {
          label: 'Under Review',
          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
        };
      case 'APPROVED':
        return {
          label: 'Approved',
          color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
        };
      case 'DEPLOYING':
        return {
          label: 'Deploying',
          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
        };
      case 'DEPLOYED':
        return {
          label: 'Deployed',
          color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
        };
      case 'UPCOMING':
        return {
          label: 'Upcoming',
          color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
        };
      case 'LIVE':
        return { label: 'Live', color: 'bg-green-500 text-white animate-pulse' };
      case 'ENDED':
        return {
          label: 'Ended',
          color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
        };
      case 'FINALIZED':
        return {
          label: 'Finalized',
          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
        };
      case 'SUCCESS':
        return {
          label: 'Success',
          color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
        };
      case 'FAILED':
        return {
          label: 'Failed',
          color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
        };
      case 'REJECTED':
        return {
          label: 'Rejected',
          color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
        };
      case 'GRADUATED':
        return {
          label: 'Graduated 🎓',
          color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.label}
    </span>
  );
}
