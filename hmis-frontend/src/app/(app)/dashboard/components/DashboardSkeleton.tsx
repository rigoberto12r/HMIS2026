'use client';

import { motion } from 'framer-motion';

export function DashboardSkeleton() {
  return (
    <div
      className="-m-4 lg:-m-6 p-4 lg:p-6 min-h-[calc(100vh-4rem)]"
      style={{ background: `rgb(var(--hos-bg-primary))` }}
    >
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-white/5 rounded animate-pulse" />
        </div>

        {/* KPI cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.35 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-24 bg-white/5 rounded animate-pulse" />
                  <div className="h-9 w-20 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/5 animate-pulse" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 hos-card space-y-4">
            <div className="h-5 w-40 bg-white/5 rounded animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-white/[0.02] rounded animate-pulse" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 hos-card space-y-4">
            <div className="h-5 w-32 bg-white/5 rounded animate-pulse" />
            <div className="h-48 bg-white/[0.02] rounded animate-pulse" />
          </div>
        </div>

        {/* Additional charts */}
        <div className="hos-card space-y-4">
          <div className="h-5 w-48 bg-white/5 rounded animate-pulse" />
          <div className="h-80 bg-white/[0.02] rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
