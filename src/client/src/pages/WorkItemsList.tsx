import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { WorkItem, Team, Priority, WorkItemType, WorkItemStatus } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { StatusBadge, PriorityBadge } from '../components/Badge.js';
import { TableRowSkeleton } from '../components/Skeleton.js';
import { EmptyState } from '../components/EmptyState.js';
import {
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  FileCheck2,
  Inbox,
  User,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';

interface PaginatedResponse {
  items: WorkItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const WorkItemsList: React.FC = () => {
  const { user, hasTeamRole } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Filters & Search state
  const [teamId, setTeamId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);

  // Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createTeamId, setCreateTeamId] = useState('');
  const [createType, setCreateType] = useState<WorkItemType>('TASK');
  const [createPriority, setCreatePriority] = useState<Priority>('MEDIUM');
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch user's teams
  const { data: teams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => apiRequest<Team[]>('/api/teams')
  });

  // Build query string
  const queryParams = new URLSearchParams();
  if (teamId) queryParams.set('teamId', teamId);
  if (status) queryParams.set('status', status);
  if (priority) queryParams.set('priority', priority);
  if (assigneeId) queryParams.set('assigneeId', assigneeId);
  if (search) queryParams.set('search', search);
  if (cursor) queryParams.set('cursor', cursor);
  queryParams.set('limit', '12');

  // Fetch Work Items
  const { data, isLoading, error, refetch, isFetching } = useQuery<PaginatedResponse>({
    queryKey: ['items', teamId, status, priority, assigneeId, search, cursor],
    queryFn: () => apiRequest<PaginatedResponse>(`/api/items?${queryParams.toString()}`)
  });

  // Create Work Item Mutation with client-side Idempotency-Key
  const createMutation = useMutation({
    mutationFn: (payload: any) => {
      const idempotencyKey = crypto.randomUUID();
      return apiRequest<WorkItem>('/api/items', {
        method: 'POST',
        idempotencyKey,
        body: JSON.stringify(payload)
      });
    },
    onSuccess: (createdItem) => {
      setIsModalOpen(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateError(null);
      toast.success('Work Item Created', `"${createdItem.title}" committed to database.`);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to create work item';
      setCreateError(msg);
      toast.error('Creation Failed', msg);
    }
  });

  const handleNextPage = () => {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor]);
      setCursor(data.nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const previous = cursorHistory[cursorHistory.length - 1];
      setCursorHistory((prev) => prev.slice(0, -1));
      setCursor(previous);
    }
  };

  const resetAllFilters = () => {
    setTeamId('');
    setStatus('');
    setPriority('');
    setAssigneeId('');
    setSearch('');
    setCursor(null);
    setCursorHistory([]);
    toast.info('Filters Reset', 'Showing all operational records across teams.');
  };

  const hasActiveFilters = teamId || status || priority || assigneeId || search;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const targetTeam = createTeamId || (teams && teams[0]?.id);
    if (!targetTeam) {
      setCreateError('Please select a team for this work item');
      return;
    }

    createMutation.mutate({
      title: createTitle,
      description: createDesc,
      teamId: targetTeam,
      type: createType,
      priority: createPriority
    });
  };

  const isAnyMember = teams?.some((t) => hasTeamRole(t.id, 'MEMBER'));

  return (
    <div className="app-container space-y-6 animate-fade-in">
      {/* Top Header & New Item Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
              Operations Registry
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] text-slate-400 font-mono">
              Composite Cursor Pagination
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            Work Items
            {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />}
          </h1>
        </div>

        {isAnyMember && (
          <button
            onClick={() => {
              setCreateTeamId((teams && teams[0]?.id) || '');
              setIsModalOpen(true);
            }}
            className="btn-primary text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Work Item</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 space-y-3.5 border-slate-800/90 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input with Clear Button */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCursor(null);
                setCursorHistory([]);
              }}
              placeholder="Search title, description, or keyword..."
              className="input-field pl-9 pr-8 text-xs"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setCursor(null);
                  setCursorHistory([]);
                }}
                className="absolute right-2.5 top-3 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Team Filter */}
          <div>
            <select
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                setCursor(null);
                setCursorHistory([]);
              }}
              className="input-field text-xs"
            >
              <option value="">All Teams ({teams?.length || 0})</option>
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCursor(null);
                setCursorHistory([]);
              }}
              className="input-field text-xs"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="AWAITING_APPROVAL">AWAITING APPROVAL</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setCursor(null);
                setCursorHistory([]);
              }}
              className="input-field text-xs"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">URGENT</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>

        {/* Quick Assignee Chips & Reset Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 flex items-center gap-1 font-semibold uppercase text-[10px] tracking-wider mr-1">
              <Filter className="w-3 h-3 text-indigo-400" /> Assignee:
            </span>

            <button
              onClick={() => {
                setAssigneeId('');
                setCursor(null);
                setCursorHistory([]);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                assigneeId === ''
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Everyone
            </button>

            <button
              onClick={() => {
                setAssigneeId('me');
                setCursor(null);
                setCursorHistory([]);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                assigneeId === 'me'
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Assigned to Me
            </button>

            <button
              onClick={() => {
                setAssigneeId('unassigned');
                setCursor(null);
                setCursorHistory([]);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                assigneeId === 'unassigned'
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Unassigned
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium underline"
            >
              <RotateCcw className="w-3 h-3" />
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Items Registry (Desktop Table & Mobile Cards) */}
      <div className="glass-panel border-slate-800/90 overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="p-4 space-y-1">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        ) : data?.items.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              icon={Inbox}
              title="No Items Found"
              description="No work items match your current search and filter settings. Try clearing active filters."
              actionText={hasActiveFilters ? 'Clear Filters' : undefined}
              onAction={hasActiveFilters ? resetAllFilters : undefined}
              accentColor="indigo"
            />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Priority & Status</th>
                    <th className="py-3 px-4">Work Item Title</th>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">Assignee</th>
                    <th className="py-3 px-4 text-right">Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {data?.items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => window.location.assign(`/items/${item.id}`)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={item.priority} />
                          <StatusBadge status={item.status} />
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors text-xs line-clamp-1">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 max-w-lg">
                            {item.description}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-medium">
                        {item.team?.name}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-indigo-400 font-bold border border-slate-700">
                            {item.assignee?.name ? item.assignee.name[0] : '?'}
                          </div>
                          <span className={`text-xs ${item.assignee ? 'text-slate-200' : 'text-amber-400 font-mono'}`}>
                            {item.assignee?.name || 'Unassigned'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                          v{item.version}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {data?.items.map((item) => (
                <Link
                  key={item.id}
                  to={`/items/${item.id}`}
                  className="block p-4 space-y-2.5 text-decoration-none hover:bg-slate-900/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">v{item.version}</span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-100 line-clamp-2">
                    {item.title}
                  </h3>

                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <span>{item.team?.name}</span>
                    <span className={item.assignee ? 'text-slate-300' : 'text-amber-400'}>
                      {item.assignee?.name || 'Unassigned'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Stable Cursor Pagination Controls */}
        <div className="p-3.5 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="font-mono text-[11px]">
            {cursorHistory.length > 0 ? `Page ${cursorHistory.length + 1}` : 'Page 1'} · Showing records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={cursorHistory.length === 0}
              className="btn-secondary py-1 px-3 text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={handleNextPage}
              disabled={!data?.hasMore}
              className="btn-secondary py-1 px-3 text-xs"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* New Work Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-xl p-6 sm:p-7 border-slate-700/80 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-slate-100 font-bold text-base">
                <FileCheck2 className="w-5 h-5 text-indigo-400" />
                <span>Create New Work Item</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="input-label" htmlFor="create-title">
                  Title
                </label>
                <input
                  id="create-title"
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Ingress proxy packet corruption on port 443"
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="input-label" htmlFor="create-desc">
                  Description
                </label>
                <textarea
                  id="create-desc"
                  rows={4}
                  required
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Detail incident findings, affected nodes, diagnostic logs..."
                  className="input-field text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="input-label">Target Team</label>
                  <select
                    value={createTeamId}
                    onChange={(e) => setCreateTeamId(e.target.value)}
                    className="input-field text-xs"
                  >
                    {teams?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Type</label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value as WorkItemType)}
                    className="input-field text-xs"
                  >
                    <option value="TASK">TASK</option>
                    <option value="BUG">BUG</option>
                    <option value="INCIDENT">INCIDENT</option>
                    <option value="FEATURE">FEATURE</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">Priority</label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value as Priority)}
                    className="input-field text-xs"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-200">Transactional Idempotency:</span>{' '}
                Submissions automatically generate a unique{' '}
                <code className="text-indigo-400 font-mono">Idempotency-Key</code> header to prevent duplicate records
                under concurrent network retries.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary text-xs"
                >
                  {createMutation.isPending ? 'Committing...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
