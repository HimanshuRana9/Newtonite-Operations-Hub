import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { DashboardMetrics, WorkItem } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { StatusBadge, PriorityBadge } from '../components/Badge.js';
import { MetricSkeleton, CardSkeleton } from '../components/Skeleton.js';
import { EmptyState } from '../components/EmptyState.js';
import {
  Flame,
  CheckCircle2,
  Clock,
  Inbox,
  AlertTriangle,
  ArrowRight,
  HandMetal,
  RefreshCw,
  Plus,
  ShieldAlert,
  ArrowUpRight,
  Activity
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [claimError, setClaimError] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<DashboardMetrics>('/api/items/dashboard')
  });

  const claimMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiRequest<WorkItem>(`/api/items/${itemId}/claim`, { method: 'POST' }),
    onSuccess: (claimedItem) => {
      setClaimError(null);
      toast.success('Work Item Claimed', `You have claimed "${claimedItem.title}". Moved to IN PROGRESS.`);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to claim work item';
      setClaimError(msg);
      toast.error('Claim Failed', msg);
    }
  });

  const handleClaim = (itemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setClaimError(null);
    claimMutation.mutate(itemId);
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  const { assignedToMe, unassignedUrgent, awaitingApproval, counts } = data || {
    assignedToMe: [],
    unassignedUrgent: [],
    awaitingApproval: [],
    counts: { myCount: 0, urgentCount: 0, approvalCount: 0, openCount: 0 }
  };

  return (
    <div className="app-container space-y-7 animate-fade-in">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Real-Time Telemetry
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] text-slate-400 font-mono">
              Live for <span className="text-slate-200 font-semibold">{user?.name}</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            Operational Command Center
            {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              refetch();
              toast.info('Metrics Refreshed', 'Telemetry updated with latest database state.');
            }}
            disabled={isFetching}
            className="btn-secondary text-xs"
            title="Refresh operational telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link to="/items" className="btn-primary text-xs">
            <span>Browse All Items</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Persistent Claim Error Notice */}
      {claimError && (
        <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="font-medium">{claimError}</span>
          </div>
          <button
            onClick={() => setClaimError(null)}
            className="text-slate-400 hover:text-white text-xs underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            {/* Card 1: Assigned to Me */}
            <div className="kpi-card kpi-card-blue">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Assigned To Me
                </span>
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                  <Inbox className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-100 tracking-tight font-mono">
                {counts.myCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>Active tasks in flight</span>
              </div>
            </div>

            {/* Card 2: Unassigned Urgent */}
            <div className="kpi-card kpi-card-rose bg-rose-950/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                  Unassigned Urgent
                </span>
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                  <Flame className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-rose-200 tracking-tight font-mono">
                {counts.urgentCount}
              </div>
              <div className="text-[11px] text-rose-300/80 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                <span>Requires immediate claim</span>
              </div>
            </div>

            {/* Card 3: Awaiting Approval */}
            <div className="kpi-card kpi-card-purple bg-purple-950/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                  Awaiting Approval
                </span>
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-purple-200 tracking-tight font-mono">
                {counts.approvalCount}
              </div>
              <div className="text-[11px] text-purple-300/80 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>Lead / Admin review gate</span>
              </div>
            </div>

            {/* Card 4: Total Open Queue */}
            <div className="kpi-card kpi-card-emerald">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Open Queue
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-100 tracking-tight font-mono">
                {counts.openCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Across authorized teams</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3 Main Action Queues */}
      <div className="grid md:grid-cols-3 gap-6 pt-2">
        {/* Column 1: Unassigned Urgent Queue */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" />
              <span>Unassigned Urgent</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px]">
                {unassignedUrgent.length}
              </span>
            </h2>
            <Link to="/items?assigneeId=unassigned&priority=URGENT" className="text-[11px] text-slate-400 hover:text-white flex items-center gap-0.5">
              <span>View all</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : unassignedUrgent.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No Urgent Incidents"
                description="All high-priority operational items are claimed or resolved."
                accentColor="emerald"
              />
            ) : (
              unassignedUrgent.map((item) => (
                <div
                  key={item.id}
                  className="glass-card p-4 space-y-3 border-rose-950/60 bg-gradient-to-b from-rose-950/10 to-transparent hover:border-rose-500/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <PriorityBadge priority={item.priority} />
                    <span className="text-[10px] text-slate-500 font-mono">v{item.version}</span>
                  </div>

                  <Link to={`/items/${item.id}`} className="block group">
                    <h3 className="text-xs font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                  </Link>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80 text-[11px]">
                    <div className="text-slate-400 flex items-center gap-1.5 truncate max-w-[130px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      <span className="truncate">{item.team?.name}</span>
                    </div>

                    <button
                      onClick={(e) => handleClaim(item.id, e)}
                      disabled={claimMutation.isPending}
                      className="btn-claim"
                      title="Atomically claim this incident"
                    >
                      <HandMetal className="w-3 h-3" />
                      <span>Claim Item</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Assigned to Me Queue */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-blue-400" />
              <span>Assigned to Me</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-mono text-[10px]">
                {assignedToMe.length}
              </span>
            </h2>
            <Link to="/items?assigneeId=me" className="text-[11px] text-slate-400 hover:text-white flex items-center gap-0.5">
              <span>View all</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : assignedToMe.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Queue is Clear"
                description="You have no tasks assigned. Claim an urgent incident or browse the team registry."
                actionText="Explore Work Items"
                onAction={() => window.location.assign('/items')}
                accentColor="indigo"
              />
            ) : (
              assignedToMe.map((item) => (
                <Link
                  key={item.id}
                  to={`/items/${item.id}`}
                  className="block glass-card p-4 space-y-2.5 text-decoration-none group hover:border-blue-500/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-[10px] text-slate-500 font-mono">v{item.version}</span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <PriorityBadge priority={item.priority} />
                    <span className="truncate max-w-[120px] text-slate-400">{item.team?.name}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Awaiting Approval Queue */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Awaiting Approval</span>
              <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono text-[10px]">
                {awaitingApproval.length}
              </span>
            </h2>
            <Link to="/items?status=AWAITING_APPROVAL" className="text-[11px] text-slate-400 hover:text-white flex items-center gap-0.5">
              <span>View all</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : awaitingApproval.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All Approvals Settled"
                description="No items pending Lead or Admin sign-off."
                accentColor="indigo"
              />
            ) : (
              awaitingApproval.map((item) => (
                <Link
                  key={item.id}
                  to={`/items/${item.id}`}
                  className="block glass-card p-4 space-y-2.5 text-decoration-none group border-purple-950/50 bg-gradient-to-b from-purple-950/10 to-transparent hover:border-purple-500/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-[10px] text-slate-500 font-mono">v{item.version}</span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-100 group-hover:text-purple-300 transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <span>Assignee: {item.assignee?.name || 'Unassigned'}</span>
                    <span className="text-purple-300 font-mono font-semibold">Review Gate</span>
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
