import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { DashboardMetrics, WorkItem } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Flame,
  CheckCircle2,
  Clock,
  Inbox,
  AlertTriangle,
  ArrowRight,
  HandMetal,
  Check,
  RefreshCw
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [claimError, setClaimError] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<DashboardMetrics>('/api/items/dashboard')
  });

  const claimMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiRequest<WorkItem>(`/api/items/${itemId}/claim`, { method: 'POST' }),
    onSuccess: () => {
      setClaimError(null);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (err: any) => {
      setClaimError(err.message || 'Failed to claim work item');
    }
  });

  const handleClaim = (itemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setClaimError(null);
    claimMutation.mutate(itemId);
  };

  if (isLoading) {
    return (
      <div className="app-container py-12 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-400 mb-3" />
        <p className="text-sm font-medium">Loading operational metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container py-8">
        <div className="glass-panel p-6 border-rose-900/50 bg-rose-950/20 text-rose-300">
          <AlertTriangle className="w-6 h-6 mb-2 text-rose-400" />
          <h2 className="text-base font-semibold">Error Loading Dashboard</h2>
          <p className="text-xs text-rose-300 mt-1">{(error as any)?.message}</p>
          <button onClick={() => refetch()} className="btn-secondary mt-4 text-xs">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { assignedToMe, unassignedUrgent, awaitingApproval, counts } = data || {
    assignedToMe: [],
    unassignedUrgent: [],
    awaitingApproval: [],
    counts: { myCount: 0, urgentCount: 0, approvalCount: 0, openCount: 0 }
  };

  return (
    <div className="app-container space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Operational Overview
            {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time status for <span className="text-indigo-400 font-medium">{user?.name}</span> across authorized teams
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-secondary text-xs" title="Refresh metrics">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link to="/items" className="btn-primary text-xs">
            Browse All Items
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {claimError && (
        <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{claimError}</span>
          </div>
          <button onClick={() => setClaimError(null)} className="text-slate-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 border-slate-800/80 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned To Me</span>
            <Inbox className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{counts.myCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Active tasks in flight</div>
        </div>

        <div className="glass-panel p-4 border-rose-950/60 bg-rose-950/10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Unassigned Urgent</span>
            <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-rose-200">{counts.urgentCount}</div>
          <div className="text-[11px] text-rose-400/80 mt-1">Requires immediate claim</div>
        </div>

        <div className="glass-panel p-4 border-purple-950/60 bg-purple-950/10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Awaiting Approval</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-200">{counts.approvalCount}</div>
          <div className="text-[11px] text-purple-400/80 mt-1">Lead/Admin gatekeeper</div>
        </div>

        <div className="glass-panel p-4 border-slate-800/80 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Open Queue</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{counts.openCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Across your memberships</div>
        </div>
      </div>

      {/* 3 Main Action Columns */}
      <div className="grid md:grid-cols-3 gap-6 pt-2">
        {/* Column 1: Unassigned Urgent */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              Unassigned Urgent ({unassignedUrgent.length})
            </h2>
          </div>

          <div className="space-y-2.5">
            {unassignedUrgent.length === 0 ? (
              <div className="glass-panel p-6 text-center text-xs text-slate-500">
                No unassigned urgent incidents. Everything is under control!
              </div>
            ) : (
              unassignedUrgent.map((item) => (
                <div key={item.id} className="glass-card p-3.5 space-y-2.5 border-rose-950/50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded badge-priority-URGENT font-bold">
                      {item.priority}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">v{item.version}</span>
                  </div>

                  <Link to={`/items/${item.id}`} className="block group">
                    <h3 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                  </Link>

                  <div className="text-[11px] text-slate-400 line-clamp-2">{item.description}</div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                    <span className="text-slate-400">{item.team?.name}</span>
                    <button
                      onClick={(e) => handleClaim(item.id, e)}
                      disabled={claimMutation.isPending}
                      className="btn-primary py-1 px-2.5 text-[11px] bg-rose-600 hover:bg-rose-500"
                    >
                      <HandMetal className="w-3 h-3" />
                      Claim Item
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Assigned to Me */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Inbox className="w-4 h-4" />
              Assigned to Me ({assignedToMe.length})
            </h2>
          </div>

          <div className="space-y-2.5">
            {assignedToMe.length === 0 ? (
              <div className="glass-panel p-6 text-center text-xs text-slate-500">
                You have no items assigned right now. Claim an urgent task or browse the queue!
              </div>
            ) : (
              assignedToMe.map((item) => (
                <Link key={item.id} to={`/items/${item.id}`} className="block glass-card p-3.5 space-y-2 text-decoration-none">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold badge-status-${item.status}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">v{item.version}</span>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-200 hover:text-indigo-300 transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded badge-priority-${item.priority}`}>
                      {item.priority}
                    </span>
                    <span>{item.team?.name}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Awaiting Approval */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Awaiting Approval ({awaitingApproval.length})
            </h2>
          </div>

          <div className="space-y-2.5">
            {awaitingApproval.length === 0 ? (
              <div className="glass-panel p-6 text-center text-xs text-slate-500">
                No items pending sign-off.
              </div>
            ) : (
              awaitingApproval.map((item) => (
                <Link key={item.id} to={`/items/${item.id}`} className="block glass-card p-3.5 space-y-2 text-decoration-none border-purple-950/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold badge-status-AWAITING_APPROVAL">
                      AWAITING APPROVAL
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">v{item.version}</span>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-200 hover:text-indigo-300 transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <span>Assignee: {item.assignee?.name || 'Unassigned'}</span>
                    <span className="text-purple-300 font-medium">Review Needed</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
