import React from 'react';

export const MetricSkeleton: React.FC = () => {
  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex justify-between items-center">
        <div className="skeleton w-24 h-3 rounded" />
        <div className="skeleton w-6 h-6 rounded-full" />
      </div>
      <div className="skeleton w-16 h-7 rounded" />
      <div className="skeleton w-32 h-2.5 rounded" />
    </div>
  );
};

export const TableRowSkeleton: React.FC = () => {
  return (
    <div className="p-4 flex items-center justify-between border-b border-slate-800/60">
      <div className="space-y-2 flex-1">
        <div className="flex gap-2">
          <div className="skeleton w-16 h-4 rounded-full" />
          <div className="skeleton w-20 h-4 rounded-full" />
        </div>
        <div className="skeleton w-3/4 h-4 rounded" />
        <div className="skeleton w-1/2 h-3 rounded" />
      </div>
      <div className="w-24 text-right space-y-1 hidden sm:block">
        <div className="skeleton w-16 h-3 rounded ml-auto" />
        <div className="skeleton w-20 h-2.5 rounded ml-auto" />
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex justify-between items-center">
        <div className="skeleton w-16 h-4 rounded-full" />
        <div className="skeleton w-8 h-3 rounded" />
      </div>
      <div className="skeleton w-full h-4 rounded" />
      <div className="skeleton w-4/5 h-3 rounded" />
      <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center">
        <div className="skeleton w-20 h-3 rounded" />
        <div className="skeleton w-16 h-6 rounded" />
      </div>
    </div>
  );
};
