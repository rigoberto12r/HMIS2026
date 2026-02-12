import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded bg-surface-200 dark:bg-surface-700 shimmer', className)} />
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-t border-surface-100 dark:border-surface-700">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={`${r}-${c}`}
              className={cn('h-4 flex-1', c === 0 && 'max-w-[120px]')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
