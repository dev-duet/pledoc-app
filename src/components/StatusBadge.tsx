import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { VerificationStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: VerificationStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = {
    needs_review: {
      label: 'Under review',
      icon: Clock,
      bg: 'bg-data-100',
      text: 'text-data-800',
      border: 'border-data-200',
      dot: 'bg-data-600',
    },
    verified: {
      label: 'Verified',
      icon: CheckCircle2,
      bg: 'bg-citizen-100',
      text: 'text-citizen-700',
      border: 'border-citizen-200',
      dot: 'bg-citizen-600',
    },
    invalid: {
      label: 'Invalid',
      icon: XCircle,
      bg: 'bg-ink-100',
      text: 'text-ink-600',
      border: 'border-ink-400/40',
      dot: 'bg-ink-500',
    },
  };

  const c = config[status];
  const Icon = c.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${c.bg} ${c.text} ${c.border} ${sizeClasses} font-semibold`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === 'needs_review' ? 'animate-pulse-soft' : ''}`} />
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {c.label}
    </span>
  );
}
