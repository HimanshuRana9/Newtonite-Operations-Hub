import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { DashboardMetrics, WorkItem } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { StatusBadge, PriorityBadge } from '../components/Badge.js';
import { MetricSkeleton, CardSkeleton } from '../components/Skeleton.js';
import { RowMenu } from '../components/RowMenu.js';
import { initials, formatDate } from '../utils/format.js';
import {
  Flame, CheckCircle2, Clock, Inbox, AlertTriangle, ArrowRight, ChevronRight, HandMetal,
  RefreshCw, Layers, User, BarChart3, ShieldCheck, Sparkles, Calendar, MoreHorizontal
} from 'lucide-react';
import { Robot } from '../components/Robot.js';

// The API returns at most 10 rows per queue, so a count of 10 means "10 or more".
const formatCount = (n: number) => (n >= 10 ? '10+' : String(n));

type Tone = 'blue' | 'rose' | 'violet' | 'emerald';

// Mini Sparkline component matching the dashboard screenshots
const Sparkline: React.FC<{ tone: Tone }> = ({ tone }) => {
  const barColors = {
    blue: 'bg-blue-400',
    rose: 'bg-rose-400',
    violet: 'bg-purple-400',
    emerald: 'bg-emerald-400'
  };
  const heights = [35, 60, 45, 80, 55, 95];
  return (
    <div className="flex items-end gap-1 h-6 shrink-0 opacity-75">
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-1 rounded-full ${barColors[tone]}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
};

const Kpi: React.FC<{
  to: string;
  label: string;
  value: string;
  caption: string;
  tone: Tone;
  icon: React.ReactNode;
}> = ({ to, label, value, caption, tone, icon }) => {
  const cardStyles = {
    blue: 'border-blue-500/30 bg-[#091124]/90 shadow-[0_0_25px_rgba(59,130,246,0.15)] hover:border-blue-400/60',
    rose: 'border-rose-500/30 bg-[#1a0c16]/90 shadow-[0_0_25px_rgba(244,63,94,0.15)] hover:border-rose-400/60',
    violet: 'border-purple-500/30 bg-[#150c26]/90 shadow-[0_0_25px_rgba(168,85,247,0.15)] hover:border-purple-400/60',
    emerald: 'border-emerald-500/30 bg-[#081816]/90 shadow-[0_0_25px_rgba(16,185,129,0.15)] hover:border-emerald-400/60'
  };

  const iconStyles = {
    blue: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
    rose: 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
    violet: 'bg-purple-500/15 text-purple-400 border border-purple-500/25',
    emerald: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
  };

  return (
    <Link
      to={to}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 ${cardStyles[tone]}`}
    >
      <div className="flex items-center justify-between">
        <div className={`w-11 h-11 rounded-xl grid place-items-center ${iconStyles[tone]}`}>
          {icon}
        </div>
        <span className="w-8 h-8 rounded-full border border-white/10 bg-white/5 grid place-items-center text-slate-300 group-hover:bg-white/15 group-hover:text-white transition">
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="flex items-end justify-between mt-1">
          <div className="text-3xl font-black text-white tracking-tight">{value}</div>
          <Sparkline tone={tone} />
        </div>
        <div className="mt-1 text-xs text-slate-400">{caption}</div>
      </div>
    </Link>
  );
};

const Panel: React.FC<{
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  count: string;
  to: string;
  children: React.ReactNode;
}> = ({ tone, icon, title, count, to, children }) => {
  const headerColors = {
    blue: 'text-sky-400',
    rose: 'text-rose-400',
    violet: 'text-purple-400',
    emerald: 'text-emerald-400'
  };

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className={`flex items-center gap-2 text-base font-bold ${headerColors[tone]}`}>
          {icon}
          <span>{title}</span>
          <span className="text-xs font-bold text-white bg-white/10 rounded-full px-2 py-0.5 ml-0.5">
            {count}
          </span>
        </h2>
        <Link to={to} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {children}
    </section>
  );
};

const ItemCard: React.FC<{
  item: WorkItem;
  canClaim?: boolean;
  extraFooter?: React.ReactNode;
}> = ({ item, canClaim = false, extraFooter }) => (
  <article className="group relative rounded-2xl border border-white/10 bg-[#0c1429]/80 backdrop-blur-xl p-4 space-y-2.5 transition-all duration-200 hover:border-blue-500/40 hover:bg-[#0f1936]/90 hover:shadow-[0_4px_20px_rgba(30,58,138,0.2)]">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <StatusBadge status={item.status} />
        <PriorityBadge priority={item.priority} />
      </div>
      <span className="font-mono text-[10px] text-slate-400 border border-white/10 rounded-md px-1.5 py-0.5 bg-white/5">
        v{item.version}
      </span>
    </div>

    <div>
      <h3 className="font-semibold text-sm text-slate-100 group-hover:text-sky-300 transition-colors">
        <Link to={`/items/${item.id}`} className="hover:underline">
          {item.title}
        </Link>
      </h3>
      <p className="text-xs text-slate-400 line-clamp-1 mt-1">{item.description}</p>
    </div>

    <div className="pt-1 flex items-center justify-between gap-2 text-xs text-slate-400 border-t border-white/5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-1 truncate text-slate-300">
          <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">{item.team?.name}</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
          <Calendar className="w-3 h-3" />
          {formatDate(item.createdAt)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {extraFooter}
        <RowMenu item={item} canClaim={canClaim} />
      </div>
    </div>
  </article>
);

export const Dashboard: React.FC = () => {
  const { user, hasTeamRole } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [claimError, setClaimError] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<DashboardMetrics>('/api/items/dashboard')
  });

  const claimMutation = useMutation({
    mutationFn: (itemId: string) => apiRequest<WorkItem>(`/api/items/${itemId}/claim`, { method: 'POST' }),
    onSuccess: (claimed) => {
      setClaimError(null);
      toast.success('Work item claimed', `"${claimed.title}" is now assigned to you.`);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (err: any) => {
      setClaimError(err.message || 'Failed to claim work item');
      toast.error('Claim failed', err.message);
    }
  });

  const { assignedToMe, unassignedUrgent, awaitingApproval, counts } = data ?? {
    assignedToMe: [], unassignedUrgent: [], awaitingApproval: [],
    counts: { myCount: 0, urgentCount: 0, approvalCount: 0, openCount: 0 }
  };

  return (
    <div className="app-container space-y-7">
      {/* Hero Command Center Header */}
      <header className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>OPERATIONS OVERVIEW</span>
            <span className="text-slate-600">·</span>
            <span className="normal-case tracking-normal font-normal text-slate-300">
              Welcome back, {user?.name}
            </span>
          </div>

          <h1 className="mt-2 text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-white leading-tight">
            Operational{' '}
            <span className="bg-gradient-to-r from-blue-300 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Command Center
            </span>
          </h1>

          <p className="mt-2 text-slate-400 text-sm sm:text-base max-w-xl">
            Track, manage, and drive operational work across your teams with speed, clarity, and confidence.
          </p>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                refetch();
                toast.info('Dashboard refreshed', 'Showing latest operational metrics.');
              }}
              disabled={isFetching}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-semibold flex items-center gap-2 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              to="/items"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold flex items-center gap-2 shadow-[0_4px_20px_rgba(37,99,235,0.45)] transition"
            >
              Browse all items <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Mascot & Ops Co-Pilot Hero Card */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative flex items-center gap-4 p-4 rounded-3xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/20 backdrop-blur-2xl shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <div className="text-left text-xs space-y-1 max-w-[210px]">
              <div className="font-bold text-slate-100 flex items-center gap-1.5 text-sm">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Ops Co-Pilot
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Concurrency safeguards online. How can I help you today?
              </p>
              <div className="flex items-center gap-1.5 pt-1 text-[10px] text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                All systems healthy.
              </div>
            </div>

            {/* 3D Mascot Floating Widget */}
            <div className="relative shrink-0">
              <Robot size={105} showHalo={true} className="animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-800 bg-rose-950/60 p-4 text-sm text-rose-200">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {(error as Error).message || 'Could not load the dashboard.'}
          </span>
          <button onClick={() => refetch()} className="underline font-semibold">Try again</button>
        </div>
      )}

      {claimError && (
        <div role="alert" className="rounded-2xl border border-amber-800 bg-amber-950/50 p-3.5 text-sm text-amber-200">
          {claimError}
        </div>
      )}

      {/* KPI Cards Row (4 cards matching design) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? [0, 1, 2, 3].map((i) => <MetricSkeleton key={i} />) : (
          <>
            <Kpi
              to="/items?assigneeId=me"
              tone="blue"
              label="Assigned to me"
              value={formatCount(counts.myCount)}
              caption="Active tasks in progress"
              icon={<User className="w-6 h-6" />}
            />
            <Kpi
              to="/items?assigneeId=unassigned&status=OPEN"
              tone="rose"
              label="Unassigned urgent"
              value={formatCount(counts.urgentCount)}
              caption="High or urgent priority"
              icon={<Flame className="w-6 h-6" />}
            />
            <Kpi
              to="/items?status=AWAITING_APPROVAL"
              tone="violet"
              label="Awaiting approval"
              value={formatCount(counts.approvalCount)}
              caption="Lead / Admin review"
              icon={<Clock className="w-6 h-6" />}
            />
            <Kpi
              to="/items"
              tone="emerald"
              label="Open queue"
              value={String(counts.openCount)}
              caption="Open and in progress"
              icon={<BarChart3 className="w-6 h-6" />}
            />
          </>
        )}
      </div>

      {/* 3 Operational Priority Queues */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Column 1: Unassigned Urgent */}
        <Panel
          tone="rose"
          icon={<Flame className="w-4 h-4 text-rose-400" />}
          title="Unassigned urgent"
          count={String(unassignedUrgent.length)}
          to="/items?assigneeId=unassigned&status=OPEN"
        >
          {isLoading ? (
            <CardSkeleton />
          ) : unassignedUrgent.length === 0 ? (
            <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-b from-[#091124]/90 to-[#070b16]/90 backdrop-blur-xl p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl grid place-items-center bg-blue-500/10 border border-blue-400/30 text-emerald-400 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">No urgent incidents</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Every high-priority item is claimed or resolved. Great work!
                </p>
              </div>
              <Link
                to="/items"
                className="mt-2 px-4 py-2 rounded-xl border border-blue-500/40 bg-blue-600/10 hover:bg-blue-600/20 text-sky-300 text-xs font-semibold flex items-center gap-2 transition"
              >
                Browse all work items <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            unassignedUrgent.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                canClaim={hasTeamRole(item.teamId, 'MEMBER')}
                extraFooter={
                  hasTeamRole(item.teamId, 'MEMBER') ? (
                    <button
                      className="btn-claim !py-1 !px-2.5 text-xs"
                      disabled={claimMutation.isPending}
                      onClick={() => {
                        setClaimError(null);
                        claimMutation.mutate(item.id);
                      }}
                    >
                      <HandMetal className="w-3.5 h-3.5" />
                      Claim
                    </button>
                  ) : undefined
                }
              />
            ))
          )}
        </Panel>

        {/* Column 2: Assigned to Me */}
        <Panel
          tone="blue"
          icon={<Inbox className="w-4 h-4 text-sky-400" />}
          title="Assigned to me"
          count={String(assignedToMe.length)}
          to="/items?assigneeId=me"
        >
          {isLoading ? (
            <CardSkeleton />
          ) : assignedToMe.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#091124]/90 backdrop-blur-xl p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl grid place-items-center bg-blue-500/10 border border-blue-400/30 text-blue-400">
                <Inbox className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">Nothing assigned</h3>
                <p className="text-xs text-slate-400 mt-1">Claim an open item to start working.</p>
              </div>
              <button
                onClick={() => navigate('/items?status=OPEN')}
                className="mt-2 px-4 py-2 rounded-xl border border-blue-500/40 bg-blue-600/10 hover:bg-blue-600/20 text-sky-300 text-xs font-semibold"
              >
                Browse open items
              </button>
            </div>
          ) : (
            assignedToMe.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                canClaim={false}
              />
            ))
          )}
        </Panel>

        {/* Column 3: Awaiting Approval */}
        <Panel
          tone="violet"
          icon={<Clock className="w-4 h-4 text-purple-400" />}
          title="Awaiting approval"
          count={String(awaitingApproval.length)}
          to="/items?status=AWAITING_APPROVAL"
        >
          {isLoading ? (
            <CardSkeleton />
          ) : awaitingApproval.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#150c26]/90 backdrop-blur-xl p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl grid place-items-center bg-purple-500/10 border border-purple-400/30 text-purple-400">
                <CheckCircle2 className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">Approval queue clear</h3>
                <p className="text-xs text-slate-400 mt-1">Nothing is waiting for review.</p>
              </div>
            </div>
          ) : (
            awaitingApproval.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                canClaim={false}
                extraFooter={
                  item.assignee ? (
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
                      <span className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold bg-purple-500/30 text-purple-200">
                        {initials(item.assignee.name)}
                      </span>
                      <span className="truncate max-w-[120px]">Assignee: {item.assignee.name}</span>
                    </span>
                  ) : undefined
                }
              />
            ))
          )}
        </Panel>
      </div>

      {/* Safety System Guarantee Callout */}
      <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 backdrop-blur-xl text-xs text-slate-300">
        <div className="w-8 h-8 rounded-xl grid place-items-center bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <b className="text-slate-100">Built for safe operations:</b> Atomic claims, optimistic concurrency control (OCC), and transactional outbox recovery are verified and enforced directly by PostgreSQL.
        </div>
        <span className="text-[10px] font-mono border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-0.5">
          ACID Enforced
        </span>
      </div>
    </div>
  );
};

