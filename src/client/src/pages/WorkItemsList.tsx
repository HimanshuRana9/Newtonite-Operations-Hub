import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Modal } from '../components/Modal.js';
import { RowMenu } from '../components/RowMenu.js';
import { PageHeader } from '../components/PageHeader.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { apiErrorMessage, formatDate, formatRelative, initials } from '../utils/format.js';
import { apiRequest } from '../api/client.js';
import { WorkItem, Team, Priority, WorkItemType } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { StatusBadge, PriorityBadge } from '../components/Badge.js';
import { TableRowSkeleton } from '../components/Skeleton.js';
import { EmptyState } from '../components/EmptyState.js';
import {
  Search,
  Layers,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  FileCheck2,
  Inbox,
  RotateCcw
} from 'lucide-react';

interface PaginatedResponse {
  items: WorkItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

const ASSIGNEE_FILTERS = [
  { value: '', label: 'Everyone' },
  { value: 'me', label: 'Assigned to me' },
  { value: 'unassigned', label: 'Unassigned' }
] as const;

export const WorkItemsList: React.FC = () => {
  const { hasTeamRole } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  // One Idempotency-Key per create attempt: reused on retries/double-clicks, renewed after success
  const createKeyRef = useRef<string>(crypto.randomUUID());

  const [searchParams] = useSearchParams();
  // Filters & Search state (initialised from the URL so dashboard/KPI links open pre-filtered)
  const [teamId, setTeamId] = useState<string>(searchParams.get('teamId') ?? '');
  const [status, setStatus] = useState<string>(searchParams.get('status') ?? '');
  const [priority, setPriority] = useState<string>(searchParams.get('priority') ?? '');
  const [assigneeId, setAssigneeId] = useState<string>(searchParams.get('assigneeId') ?? '');
  const [search, setSearch] = useState<string>(searchParams.get('search') ?? '');
  const [perPage, setPerPage] = useState<number>(10);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);
  const resetPaging = () => {
    setCursor(null);
    setCursorHistory([]);
  };

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
  // Re-sync when the URL changes while already on this page (top-bar search, team switcher, KPI links)
  useEffect(() => {
    setTeamId(searchParams.get('teamId') ?? '');
    setStatus(searchParams.get('status') ?? '');
    setPriority(searchParams.get('priority') ?? '');
    setAssigneeId(searchParams.get('assigneeId') ?? '');
    const q = searchParams.get('search') ?? '';
    setSearch(q);
    resetPaging();
  }, [searchParams]);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  // A new search term always restarts pagination
  useEffect(() => {
    resetPaging();
  }, [debouncedSearch]);

  const queryParams = new URLSearchParams();
  if (teamId) queryParams.set('teamId', teamId);
  if (status) queryParams.set('status', status);
  if (priority) queryParams.set('priority', priority);
  if (assigneeId) queryParams.set('assigneeId', assigneeId);
  if (debouncedSearch) queryParams.set('search', debouncedSearch);
  if (cursor) queryParams.set('cursor', cursor);
  queryParams.set('limit', String(perPage));

  // Fetch Work Items
  const { data, isLoading, error, refetch, isFetching } = useQuery<PaginatedResponse>({
    queryKey: ['items', teamId, status, priority, assigneeId, debouncedSearch, cursor, perPage],
    queryFn: () => apiRequest<PaginatedResponse>(`/api/items?${queryParams.toString()}`)
  });

  // Create Work Item Mutation with client-side Idempotency-Key
  const createMutation = useMutation({
    mutationFn: (payload: any) => {
      const idempotencyKey = createKeyRef.current;
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
      setCreateType('TASK');
      setCreatePriority('MEDIUM');
      setCreateError(null);
      createKeyRef.current = crypto.randomUUID();
      toast.success('Work Item Created', `"${createdItem.title}" committed to database.`);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      const msg = apiErrorMessage(err, 'Failed to create work item');
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
    resetPaging();
    if (searchParams.toString()) navigate('/items', { replace: true });
    toast.info('Filters reset', 'Showing every item you can access.');
  };

  const hasActiveFilters = teamId || status || priority || assigneeId || search;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const targetTeam = createTeamId || creatableTeams[0]?.id;
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

  // Only teams where the user can create work (backend enforces MEMBER+)
  const creatableTeams = (teams ?? []).filter((t) => hasTeamRole(t.id, 'MEMBER'));
  const isAnyMember = creatableTeams.length > 0;

  return (
    <div className="app-container space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Operations registry"
        eyebrowNote="Manage and track all work items"
        title={<>Work Items{isFetching && <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" aria-label="Loading" />}</>}
        description="Search, filter, and manage operational work across your teams."
        actions={
          isAnyMember && (
            <button
              onClick={() => {
                setCreateTeamId(creatableTeams[0]?.id || '');
                setCreateError(null);
                setIsModalOpen(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>New Work Item</span>
            </button>
          )
        }
      />

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
                resetPaging();
              }}
              placeholder="Search title, description, or keyword..."
              className="input-field pl-9 pr-8 text-xs"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  resetPaging();
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
                resetPaging();
              }}
              className="input-field text-xs"
            >
              <option value="">All teams</option>
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
                resetPaging();
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
                resetPaging();
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
            {ASSIGNEE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={assigneeId === f.value}
                onClick={() => {
                  setAssigneeId(f.value);
                  resetPaging();
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  assigneeId === f.value
                    ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {f.label}
              </button>
            ))}
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-1">
            {[0, 1, 2, 3, 4].map((i) => <TableRowSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div role="alert" className="p-8 text-center text-sm text-rose-200 space-y-3">
            <p>{(error as Error).message || 'Could not load work items.'}</p>
            <button className="btn-secondary" onClick={() => refetch()}>Try again</button>
          </div>
        ) : data?.items.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={Inbox}
              title="No items found"
              description="No work items match your search and filters. Try clearing them."
              actionText={hasActiveFilters ? 'Clear filters' : undefined}
              onAction={hasActiveFilters ? resetAllFilters : undefined}
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-slate-400 text-xs font-semibold">
                    <th className="py-3 px-4">Priority &amp; status</th>
                    <th className="py-3 px-4">Work item title</th>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">Assignee</th>
                    <th className="py-3 px-4 text-center">Version</th>
                    <th className="py-3 px-4">Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data?.items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/items/${item.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/items/${item.id}`);
                      }}
                      tabIndex={0}
                      aria-label={`Open ${item.title}`}
                      className="cursor-pointer hover:bg-white/[0.04] focus-visible:bg-white/[0.06] transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={item.priority} />
                          <StatusBadge status={item.status} />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-50 line-clamp-1">{item.title}</div>
                        <div className="text-xs text-slate-400 line-clamp-1 max-w-md">{item.description}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                        <span className="inline-flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-indigo-400" />{item.team?.name}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.assignee ? (
                          <span className="inline-flex items-center gap-2 text-slate-200">
                            <span className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold bg-indigo-500/30 text-indigo-100">{initials(item.assignee.name)}</span>
                            {item.assignee.name}
                          </span>
                        ) : (
                          <span className="text-amber-400">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono text-xs text-slate-300 border border-white/10 bg-white/5 rounded-md px-2 py-0.5">v{item.version}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-200">{formatDate(item.updatedAt)}</div>
                        <div className="text-xs text-slate-500">{formatRelative(item.updatedAt)}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <RowMenu item={item} canClaim={!item.assigneeId && item.status === 'OPEN' && hasTeamRole(item.teamId, 'MEMBER')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-white/5">
              {data?.items.map((item) => (
                <Link key={item.id} to={`/items/${item.id}`} className="block p-4 space-y-2 hover:bg-white/[0.04]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap"><PriorityBadge priority={item.priority} /><StatusBadge status={item.status} /></div>
                    <span className="font-mono text-xs text-slate-400">v{item.version}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-50 line-clamp-2">{item.title}</h3>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{item.team?.name}</span>
                    <span className={item.assignee ? 'text-slate-300' : 'text-amber-400'}>{item.assignee?.name || 'Unassigned'}</span>
                  </div>
                  <div className="text-xs text-slate-500">Updated {formatRelative(item.updatedAt)}</div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Cursor pagination: previous / next only (the API has no random page access) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-sm text-slate-400">
          <span>
            {cursorHistory.length === 0 && data && !data.hasMore
              ? `Showing all ${data.items.length} ${data.items.length === 1 ? 'item' : 'items'}`
              : `Page ${cursorHistory.length + 1} · ${data?.items.length ?? 0} items shown`}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handlePrevPage} disabled={cursorHistory.length === 0} className="btn-secondary !px-2.5 !py-1.5" aria-label="Previous page">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-8 text-center rounded-lg bg-indigo-600 px-2.5 py-1 text-white font-semibold" aria-current="page">{cursorHistory.length + 1}</span>
            <button onClick={handleNextPage} disabled={!data?.hasMore} className="btn-secondary !px-2.5 !py-1.5" aria-label="Next page">
              <ChevronRight className="w-4 h-4" />
            </button>
            <label className="ml-2 flex items-center gap-2">
              <span className="sr-only">Items per page</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); resetPaging(); }}
                className="input-field !py-1.5 !w-auto text-sm"
              >
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* New Work Item Modal */}
      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)} label="Create work item" panelClassName="max-w-xl p-6 sm:p-7">
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
                    {creatableTeams.map((t) => (
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
        </Modal>
      )}
    </div>
  );
};
