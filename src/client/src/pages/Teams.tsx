import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Layers, ArrowRight } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { Team } from '../types/index.js';
import { RoleBadge } from '../components/Badge.js';
import { CardSkeleton } from '../components/Skeleton.js';
import { EmptyState } from '../components/EmptyState.js';
import { PageHeader } from '../components/PageHeader.js';

export const Teams: React.FC = () => {
  const { data, isLoading, error, refetch } = useQuery<Team[]>({ queryKey: ['teams'], queryFn: () => apiRequest<Team[]>('/api/teams') });
  return (
    <div className="app-container space-y-6">
      <PageHeader eyebrow="Platform" title="Teams" description="Teams you belong to and your role in each." />
      {error ? (
        <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/60 p-4 text-sm text-rose-200">
          {(error as Error).message} <button className="underline ml-2" onClick={() => refetch()}>Try again</button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><CardSkeleton /><CardSkeleton /></div>
      ) : !data?.length ? (
        <EmptyState icon={Users} title="No teams yet" description="You aren't a member of any team. Ask an admin to add you." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your Active Teams</div>
              <div className="text-2xl font-bold text-white mt-1">{data.length}</div>
            </div>
            <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Team Members</div>
              <div className="text-2xl font-bold text-indigo-400 mt-1">
                {data.reduce((acc, t) => acc + (t.memberCount || 0), 0)}
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Operational Incidents</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {data.reduce((acc, t) => acc + (t.itemCount || 0), 0)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((t) => (
            <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="flex items-center gap-2 font-semibold text-slate-50"><Layers className="w-4 h-4 text-indigo-400" />{t.name}</h2>
                <RoleBadge role={t.role} />
              </div>
              <div className="text-sm text-slate-400">{t.memberCount} {t.memberCount === 1 ? 'member' : 'members'} · {t.itemCount} work {t.itemCount === 1 ? 'item' : 'items'}</div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
};
