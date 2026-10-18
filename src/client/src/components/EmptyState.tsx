import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  accentColor?: 'indigo' | 'rose' | 'emerald' | 'amber';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  accentColor = 'indigo'
}) => {
  const glowMap = {
    indigo: 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400',
    rose: 'bg-rose-600/10 border-rose-500/20 text-rose-400',
    emerald: 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-600/10 border-amber-500/20 text-amber-400'
  };

  return (
    <div className="glass-panel p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3">
      <div className={`p-3.5 rounded-2xl border ${glowMap[accentColor]} shadow-inner mb-1`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-secondary text-xs mt-3">
          {actionText}
        </button>
      )}
    </div>
  );
};
