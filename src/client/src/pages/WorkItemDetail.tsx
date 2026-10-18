import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { WorkItem, Comment, ActivityEvent, WorkItemStatus, Priority } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import {
  ArrowLeft,
  HandMetal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  History,
  MessageSquare,
  Edit3,
  Clock,
  User,
  ShieldCheck,
  RefreshCw,
  GitBranch
} from 'lucide-react';

export const WorkItemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, hasTeamRole } = useAuth();
  const queryClient = useQueryClient();

  // Action / Conflict state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('MEDIUM');

  // Fetch Work Item
  const {
    data: item,
    isLoading: isItemLoading,
    error: itemError,
    refetch: refetchItem
  } = useQuery<WorkItem>({
    queryKey: ['item', id],
    queryFn: () => apiRequest<WorkItem>(`/api/items/${id}`),
    enabled: !!id
  });

  // Fetch Comments
  const { data: comments, refetch: refetchComments } = useQuery<Comment[]>({
    queryKey: ['item-comments', id],
    queryFn: () => apiRequest<Comment[]>(`/api/items/${id}/comments`),
    enabled: !!id
  });

  // Fetch Activity Timeline
  const { data: activities, refetch: refetchActivities } = useQuery<ActivityEvent[]>({
    queryKey: ['item-activity', id],
    queryFn: () => apiRequest<ActivityEvent[]>(`/api/items/${id}/activity`),
    enabled: !!id
  });

  // Invalidate all related caches
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['item', id] });
    queryClient.invalidateQueries({ queryKey: ['item-comments', id] });
    queryClient.invalidateQueries({ queryKey: ['item-activity', id] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
  };

  // 1. Claim Mutation
  const claimMutation = useMutation({
    mutationFn: () => apiRequest<WorkItem>(`/api/items/${id}/claim`, { method: 'POST' }),
    onSuccess: () => {
      setErrorMessage(null);
      setConflictNotice(null);
      invalidateAll();
    },
    onError: (err: any) => {
      if (err.statusCode === 409) {
        setConflictNotice(err.message);
      } else {
        setErrorMessage(err.message || 'Claim failed');
      }
    }
  });

  // 2. Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: ({ targetStatus, reason }: { targetStatus: WorkItemStatus; reason?: string }) =>
      apiRequest<WorkItem>(`/api/items/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          version: item!.version,
          targetStatus,
          reason
        })
      }),
    onSuccess: () => {
      setErrorMessage(null);
      setConflictNotice(null);
      invalidateAll();
    },
    onError: (err: any) => {
      if (err.statusCode === 409) {
        setConflictNotice(err.message);
      } else {
        setErrorMessage(err.message || 'Workflow transition failed');
      }
    }
  });

  // 3. Edit Mutation (Optimistic locking)
  const editMutation = useMutation({
    mutationFn: () =>
      apiRequest<WorkItem>(`/api/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          version: item!.version,
          title: editTitle,
          description: editDesc,
          priority: editPriority
        })
      }),
    onSuccess: () => {
      setIsEditModalOpen(false);
      setErrorMessage(null);
      setConflictNotice(null);
      invalidateAll();
    },
    onError: (err: any) => {
      if (err.statusCode === 409) {
        setConflictNotice(err.message);
      } else {
        setErrorMessage(err.message || 'Edit failed');
      }
    }
  });

  // 4. Add Comment Mutation
  const commentMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest<Comment>(`/api/items/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body })
      }),
    onSuccess: () => {
      setCommentText('');
      setErrorMessage(null);
      refetchComments();
      refetchActivities();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to post comment');
    }
  });

  if (isItemLoading) {
    return (
      <div className="app-container py-16 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-400 mb-3" />
        <p className="text-sm">Loading work item specifications...</p>
      </div>
    );
  }

  if (itemError || !item) {
    return (
      <div className="app-container py-8">
        <div className="glass-panel p-6 border-rose-900/50 bg-rose-950/20 text-rose-300">
          <AlertTriangle className="w-6 h-6 mb-2 text-rose-400" />
          <h2 className="text-base font-semibold">Access Denied or Resource Not Found</h2>
          <p className="text-xs text-rose-300 mt-1">{(itemError as any)?.message}</p>
          <Link to="/items" className="btn-secondary mt-4 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Work Items
          </Link>
        </div>
      </div>
    );
  }

  const isMember = hasTeamRole(item.teamId, 'MEMBER');
  const isLeadOrAdmin = hasTeamRole(item.teamId, 'LEAD');
  const isUnassigned = !item.assigneeId;

  const openEditModal = () => {
    setEditTitle(item.title);
    setEditDesc(item.description);
    setEditPriority(item.priority);
    setConflictNotice(null);
    setIsEditModalOpen(true);
  };

  const handleRefreshConflict = () => {
    setConflictNotice(null);
    refetchItem();
    refetchActivities();
  };

  return (
    <div className="app-container space-y-6">
      {/* Top back navigation & status bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link to="/items" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase">{item.team.name}</span>
              <span className="text-slate-600">·</span>
              <span className="text-[11px] font-mono text-indigo-400">v{item.version}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">{item.title}</h1>
          </div>
        </div>

        {/* Global Item Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-mono px-2.5 py-1 rounded font-bold badge-priority-${item.priority}`}>
            {item.priority}
          </span>
          <span className={`text-xs font-mono px-2.5 py-1 rounded font-semibold badge-status-${item.status}`}>
            {item.status.replace('_', ' ')}
          </span>
          <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800/80 text-slate-300">
            {item.type}
          </span>
        </div>
      </div>

      {/* 409 Conflict Banner */}
      {conflictNotice && (
        <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-600/70 text-amber-200 text-xs space-y-2 animate-fade-in shadow-xl">
          <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            Concurrency Conflict Detected (HTTP 409)
          </div>
          <p className="text-xs text-amber-200">{conflictNotice}</p>
          <div className="pt-2">
            <button onClick={handleRefreshConflict} className="btn-primary text-xs bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Item to Latest Version
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Operational Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Card */}
          <div className="glass-panel p-6 border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Description & Context</h2>
              {isMember && (
                <button onClick={openEditModal} className="btn-secondary py-1 px-2.5 text-xs">
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Fields
                </button>
              )}
            </div>

            <div className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed bg-slate-900/60 p-4 rounded-lg border border-slate-800/80">
              {item.description}
            </div>

            {/* Quick Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 block mb-1">Assignee</span>
                <span className="text-slate-200 font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  {item.assignee?.name || (
                    <span className="text-amber-400 font-mono">Unassigned</span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block mb-1">Created By</span>
                <span className="text-slate-300">{item.creator.name}</span>
              </div>

              <div>
                <span className="text-slate-500 block mb-1">Created At</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Operational Workflow Action Center */}
          <div className="glass-panel p-5 border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Workflow Actions & State Controls
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">Current: {item.status}</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Claim Action */}
              {isUnassigned && item.status === 'OPEN' && isMember && (
                <button
                  onClick={() => claimMutation.mutate()}
                  disabled={claimMutation.isPending}
                  className="btn-primary bg-rose-600 hover:bg-rose-500 text-xs"
                >
                  <HandMetal className="w-4 h-4" />
                  Claim Unassigned Item (Atomic)
                </button>
              )}

              {/* Progress: OPEN -> IN_PROGRESS */}
              {item.status === 'OPEN' && !isUnassigned && isMember && (
                <button
                  onClick={() => transitionMutation.mutate({ targetStatus: 'IN_PROGRESS' })}
                  disabled={transitionMutation.isPending}
                  className="btn-primary text-xs"
                >
                  Start Progress
                </button>
              )}

              {/* Progress: IN_PROGRESS -> AWAITING_APPROVAL */}
              {item.status === 'IN_PROGRESS' && isMember && (
                <button
                  onClick={() => transitionMutation.mutate({ targetStatus: 'AWAITING_APPROVAL' })}
                  disabled={transitionMutation.isPending}
                  className="btn-primary bg-purple-600 hover:bg-purple-500 text-xs"
                >
                  Submit for Approval
                </button>
              )}

              {/* Direct Resolve: IN_PROGRESS -> RESOLVED */}
              {item.status === 'IN_PROGRESS' && isMember && (
                <button
                  onClick={() => transitionMutation.mutate({ targetStatus: 'RESOLVED' })}
                  disabled={transitionMutation.isPending}
                  className="btn-success text-xs"
                >
                  Mark Resolved
                </button>
              )}

              {/* Approval Gates: AWAITING_APPROVAL -> RESOLVED (Lead / Admin only) */}
              {item.status === 'AWAITING_APPROVAL' && isLeadOrAdmin && (
                <>
                  <button
                    onClick={() => transitionMutation.mutate({ targetStatus: 'RESOLVED', reason: 'Approved by team lead' })}
                    disabled={transitionMutation.isPending}
                    className="btn-success text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Work Item
                  </button>
                  <button
                    onClick={() => transitionMutation.mutate({ targetStatus: 'IN_PROGRESS', reason: 'Returned for additional testing' })}
                    disabled={transitionMutation.isPending}
                    className="btn-danger text-xs"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject / Return for Changes
                  </button>
                </>
              )}

              {/* Close Gate: RESOLVED -> CLOSED (Lead / Admin only) */}
              {item.status === 'RESOLVED' && isLeadOrAdmin && (
                <button
                  onClick={() => transitionMutation.mutate({ targetStatus: 'CLOSED' })}
                  disabled={transitionMutation.isPending}
                  className="btn-secondary text-xs"
                >
                  Close Item
                </button>
              )}

              {/* Reopen: RESOLVED -> IN_PROGRESS */}
              {item.status === 'RESOLVED' && isMember && (
                <button
                  onClick={() => transitionMutation.mutate({ targetStatus: 'IN_PROGRESS' })}
                  disabled={transitionMutation.isPending}
                  className="btn-secondary text-xs"
                >
                  Re-open to In Progress
                </button>
              )}
            </div>

            {item.status === 'AWAITING_APPROVAL' && !isLeadOrAdmin && (
              <div className="p-3 bg-purple-950/30 rounded border border-purple-900/50 text-[11px] text-purple-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>
                  This item is currently awaiting formal review. Only team members with <strong>LEAD</strong> or{' '}
                  <strong>ADMIN</strong> roles can approve or reject this transition.
                </span>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="glass-panel p-6 border-slate-800 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Collaboration & Incident Notes ({comments?.length || 0})
            </h2>

            {/* Comment List */}
            <div className="space-y-3">
              {comments?.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No comments yet. Post an operational update below.
                </div>
              ) : (
                comments?.map((comment) => (
                  <div key={comment.id} className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-200">{comment.author.name}</span>
                      <span className="text-slate-500 font-mono">
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap">{comment.body}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Box */}
            {isMember && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (commentText.trim()) commentMutation.mutate(commentText);
                }}
                className="pt-2 border-t border-slate-800/80 space-y-2"
              >
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add diagnostic notes, log snippets, or instructions..."
                  className="input-field text-xs"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={commentMutation.isPending || !commentText.trim()}
                    className="btn-primary text-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {commentMutation.isPending ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Transactional Activity Timeline */}
        <div className="space-y-4">
          <div className="glass-panel p-5 border-slate-800 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              Activity Audit Timeline
            </h2>

            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {activities?.map((act) => (
                <div key={act.id} className="relative text-xs space-y-1">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-slate-950" />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-200">{act.actor.name}</span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-indigo-400 font-bold uppercase tracking-wide">
                    {act.eventType}
                  </div>
                  {act.metadata && (
                    <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/60">
                      {act.eventType === 'CLAIMED' && 'Claimed ownership and moved to IN PROGRESS'}
                      {act.eventType === 'APPROVED' && 'Approved transition to RESOLVED'}
                      {act.eventType === 'REJECTED' && 'Returned item to IN PROGRESS'}
                      {act.eventType === 'TRANSITIONED' &&
                        `Moved from ${act.metadata.fromStatus} to ${act.metadata.toStatus}`}
                      {act.eventType === 'UPDATED' && 'Modified work item properties'}
                      {act.eventType === 'COMMENT_ADDED' && 'Added a collaboration comment'}
                      {act.eventType === 'CREATED' && 'Created initial work item'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stale Update Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 border-slate-700 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                Edit Work Item (v{item.version})
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                editMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="input-label" htmlFor="edit-title">Title</label>
                <input
                  id="edit-title"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="input-label" htmlFor="edit-desc">Description</label>
                <textarea
                  id="edit-desc"
                  rows={4}
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="input-label">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as Priority)}
                  className="input-field text-xs"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div className="p-3 bg-slate-900/60 rounded border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Optimistic Concurrency Notice:</span> This update requires version{' '}
                <code className="text-indigo-400 font-mono">v{item.version}</code>. If another user saves modifications concurrently, this edit will be rejected with HTTP 409 Conflict rather than silently lost.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="btn-primary text-xs"
                >
                  {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
