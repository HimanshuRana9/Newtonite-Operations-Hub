import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, CheckCircle2, AlertTriangle, ArrowUpRight, ShieldAlert, Clock } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { DashboardMetrics, WorkItem } from '../types/index.js';
import { PageHeader } from '../components/PageHeader.js';
import { PriorityBadge, StatusBadge } from '../components/Badge.js';
import { formatRelative } from '../utils/format.js';

interface NotificationItem {
  id: string;
  type: 'APPROVAL_NEEDED' | 'URGENT_INCIDENT' | 'ASSIGNED_TASK';
  title: string;
  description: string;
  time: string;
  link: string;
  isRead: boolean;
  severity: 'urgent' | 'warning' | 'info';
  status?: string;
  priority?: string;
}

export const Notifications: React.FC = () => {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const { data: dashboard, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<DashboardMetrics>('/api/items/dashboard'),
    refetchInterval: 15000
  });

  // Synthesize notifications from real live operational items
  const notifications: NotificationItem[] = React.useMemo(() => {
    if (!dashboard) return [];
    const items: NotificationItem[] = [];

    // 1. Items awaiting approval
    dashboard.awaitingApproval.forEach((item: WorkItem) => {
      items.push({
        id: `approval-${item.id}`,
        type: 'APPROVAL_NEEDED',
        title: 'Review Required: Awaiting Approval',
        description: `"${item.title}" is ready for Lead/Admin review in ${item.team?.name || 'your team'}.`,
        time: formatRelative(item.updatedAt),
        link: `/items/${item.id}`,
        isRead: readIds.has(`approval-${item.id}`),
        severity: 'warning',
        status: item.status
      });
    });

    // 2. Urgent unassigned items
    dashboard.unassignedUrgent.forEach((item: WorkItem) => {
      items.push({
        id: `urgent-${item.id}`,
        type: 'URGENT_INCIDENT',
        title: 'Urgent Unassigned Incident',
        description: `"${item.title}" (${item.priority}) is currently unassigned in ${item.team?.name || 'your team'}.`,
        time: formatRelative(item.createdAt),
        link: `/items/${item.id}`,
        isRead: readIds.has(`urgent-${item.id}`),
        severity: 'urgent',
        priority: item.priority
      });
    });

    // 3. Assigned to user
    dashboard.assignedToMe.slice(0, 5).forEach((item: WorkItem) => {
      items.push({
        id: `assigned-${item.id}`,
        type: 'ASSIGNED_TASK',
        title: 'Assigned to Your Queue',
        description: `"${item.title}" is currently assigned to you (${item.status}).`,
        time: formatRelative(item.updatedAt),
        link: `/items/${item.id}`,
        isRead: readIds.has(`assigned-${item.id}`),
        severity: 'info',
        status: item.status
      });
    });

    return items;
  }, [dashboard, readIds]);

  const markAllRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
  };

  const markSingleRead = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="ACTIVITY CENTER"
        title="Operational Notifications"
        description="Real-time alerts, approvals, and dispatch notifications from your teams."
        actions={
          notifications.length > 0 ? (
            <button
              onClick={markAllRead}
              className="btn btn-secondary inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              Mark all as read
            </button>
          ) : undefined
        }
      />

      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-3">
        <span>
          Showing <b className="text-slate-200">{notifications.length}</b> updates{' '}
          {unreadCount > 0 && <span className="text-indigo-400">({unreadCount} unread)</span>}
        </span>
        <span className="flex items-center gap-1.5 text-slate-500">
          <Clock className="w-3.5 h-3.5" /> Live synchronization active
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-white/5 bg-white/[0.02]">
          <CheckCircle2 className="w-10 h-10 text-emerald-400/80 mx-auto mb-3" />
          <h3 className="text-slate-200 font-semibold text-sm">All caught up</h3>
          <p className="text-slate-400 text-xs mt-1">No pending operational approvals or urgent alerts in your queue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => {
            const isUnread = !item.isRead;
            return (
              <div
                key={item.id}
                onClick={() => markSingleRead(item.id)}
                className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                  isUnread
                    ? 'bg-slate-900/80 border-indigo-500/30 shadow-[0_4px_20px_-4px_rgba(79,70,229,0.15)]'
                    : 'bg-white/[0.02] border-white/5 text-slate-400'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                    item.severity === 'urgent'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : item.severity === 'warning'
                      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                      : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                  }`}
                >
                  {item.severity === 'urgent' ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : item.severity === 'warning' ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-semibold truncate ${isUnread ? 'text-slate-100' : 'text-slate-300'}`}>
                      {item.title}
                    </h4>
                    {isUnread && <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-500">
                    <span>{item.time}</span>
                    <Link
                      to={item.link}
                      className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium transition-colors"
                    >
                      View work item <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {item.priority ? (
                  <PriorityBadge priority={item.priority} />
                ) : item.status ? (
                  <StatusBadge status={item.status} />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
