import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { WorkItem, Team, Priority, WorkItemType, WorkItemStatus } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  X,
  FileCheck2
} from 'lucide-react';

interface PaginatedResponse {
  items: WorkItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const WorkItemsList: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
  queryParams.set('limit', '10');

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
    onSuccess: () => {
      setIsModalOpen(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      setCreateError(err.message || 'Failed to create work item');
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

  return (
    <div className="app-container space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Work Items Registry
            {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Server-side filtered, indexed, and cursor-paginated operations queue
          </p>
        </div>

        <button
          onClick={() => {
            setCreateTeamId(teams && teams[0]?.id || '');
            setIsModalOpen(true);
          }}
          className="btn-primary text-xs"
        >
          <Plus className="w-4 h-4" />
          New Work Item
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 space-y-3 border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCursor(null);
                setCursorHistory([]);
              }}
              placeholder="Search title or description..."
              className="input-field pl-9 text-xs"
            />
          </div>

          {/* Team filter */}
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
              <option value="">All Teams</option>
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
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

          {/* Priority filter */}
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

        {/* Quick Assignee toggles */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 text-xs">
          <span className="text-slate-400 flex items-center gap-1 font-semibold uppercase text-[10px] tracking-wider">
            <Filter className="w-3 h-3" /> Assignee:
          </span>
          <button
            onClick={() => {
              setAssigneeId('');
              setCursor(null);
              setCursorHistory([]);
            }}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              assigneeId === '' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'
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
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              assigneeId === 'me' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'
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
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              assigneeId === 'unassigned' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            Unassigned
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-panel p-4 border-rose-900/50 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Failed to load items: {(error as any)?.message}</span>
        </div>
      )}

      {/* Items Table / List */}
      <div className="glass-panel border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            Loading registry...
          </div>
        ) : data?.items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No work items match the selected criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {data?.items.map((item) => (
              <Link
                key={item.id}
                to={`/items/${item.id}`}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors text-decoration-none group"
              >
                <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold badge-priority-${item.priority}`}>
                      {item.priority}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold badge-status-${item.status}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400">
                      {item.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">v{item.version}</span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors truncate">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-1">{item.description}</p>
                </div>

                <div className="flex items-center gap-6 text-xs text-slate-400 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-slate-300 font-medium">{item.assignee?.name || 'Unassigned'}</div>
                    <div className="text-[11px] text-slate-500">{item.team?.name}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Cursor Pagination Controls */}
        <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing page records {cursorHistory.length > 0 ? `(Page ${cursorHistory.length + 1})` : '(Page 1)'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={cursorHistory.length === 0}
              className="btn-secondary py-1 px-2.5 text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={!data?.hasMore}
              className="btn-secondary py-1 px-2.5 text-xs"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* New Work Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-xl p-6 border-slate-700 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-slate-100 font-bold text-base">
                <FileCheck2 className="w-5 h-5 text-indigo-400" />
                Create New Work Item
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="input-label" htmlFor="create-title">Title</label>
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
                <label className="input-label" htmlFor="create-desc">Description</label>
                <textarea
                  id="create-desc"
                  rows={4}
                  required
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Provide context, metrics, and incident diagnosis..."
                  className="input-field text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
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

              <div className="p-3 bg-slate-900/60 rounded border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Engineering note:</span> An{' '}
                <code className="text-indigo-400 font-mono">Idempotency-Key</code> UUID will be sent in headers to guarantee
                zero duplicate records under network retries or simultaneous duplicate submissions.
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
