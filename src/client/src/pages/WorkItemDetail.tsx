import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { WorkItem, Comment, ActivityEvent, WorkItemStatus, Priority } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { StatusBadge, PriorityBadge } from '../components/Badge.js';
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
  GitBranch,
  Copy,
  Check,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

export const WorkItemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, hasTeamRole } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Action / Conflict state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Rejection reason modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Requires additional testing and documentation review');

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
    onSuccess: (updated) => {
      setErrorMessage(null);
      setConflictNotice(null);
      toast.success('Incident Claimed', 'Ownership assigned to you. Status updated to IN PROGRESS.');
      invalidateAll();
    },
    onError: (err: any) => {
      if (err.statusCode === 409) {
        setConflictNotice(err.message);
        toast.error('Claim Conflict', err.message);
      } else {
        setErrorMessage(err.message || 'Claim failed');
        toast.error('Claim Error', err.message);
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
    onSuccess: (updated, variables) => {
      setErrorMessage(null);
      setConflictNotice(null);
      setIsRejectModalOpen(false);
      toast.success('Status Transitioned', `Item moved to ${variables.targetStatus.replace('_', ' ')}.`);
      invalidateAll();
    },
    onError: (err: any) => {
      if (err.statusCode === 409) {
        setConflictNotice(err.message);
        toast.error('Stale Version Conflict', err.message);
      } else {
        setErrorMessage(err.message || 'Workflow transition failed');
        toast.error('Transition Rejected', err.message);
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
      toast.success('Work Item Updated', 'Changes saved with incremented version.');
      invalidateAll();
    },
    onError: (err: any) => {
      if (err.statusCode === 409) {
        setConflictNotice(err.message);
        toast.error('Stale Edit Conflict (HTTP 409)', err.message);
      } else {
        setErrorMessage(err.message || 'Edit failed');
        toast.error('Edit Failed', err.message);
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
      toast.success('Comment Added', 'Your note has been posted to the activity record.');
      refetchComments();
      refetchActivities();
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to post comment';
      setErrorMessage(msg);
      toast.error('Comment Failed', msg);
    }
  });

  const copyItemId = () => {
    if (id) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      toast.info('Copied to Clipboard', `UUID ${id} copied.`);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleRefreshConflict = () => {
    setConflictNotice(null);
    refetchItem();
    refetchActivities();
    toast.info('Refreshed', 'Loaded latest item state and version from database.');
  };

  if (isItemLoading) {
    return (
      <div className="app-container py-20 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-400 mb-3" />
        <p className="text-sm font-medium">Resolving work item telemetry...</p>
      </div>
    );
  }

  if (itemError || !item) {
    return (
      <div className="app-container py-10">
        <div className="glass-panel p-8 border-rose-900/60 bg-rose-950/20 text-rose-300 max-w-lg mx-auto text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <h2 className="text-base font-bold">Access Denied or Resource Not Found</h2>
          <p className="text-xs text-rose-300/80 leading-relaxed">
            {(itemError as any)?.message || 'The requested work item could not be retrieved.'}
          </p>
          <Link to="/items" className="btn-secondary text-xs inline-flex mt-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Work Items
          </Link>
        </div>
      </div>
    );
  }

  const isMember = hasTeamRole(item.teamId, 'MEMBER');
  const isLeadOrAdmin = hasTeamRole(item.teamId, 'LEAD');
  const isAdmin = hasTeamRole(item.teamId, 'ADMIN');
  const isUnassigned = !item.assigneeId;

  const openEditModal = () => {
    setEditTitle(item.title);
    setEditDesc(item.description);
    setEditPriority(item.priority);
    setConflictNotice(null);
    setIsEditModalOpen(true);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'CREATED':
        return <Sparkles className="w-3.5 h-3.5 text-indigo-400" />;
      case 'CLAIMED':
        return <HandMetal className="w-3.5 h-3.5 text-rose-400" />;
      case 'APPROVED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'REJECTED':
        return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'TRANSITIONED':
        return <GitBranch className="w-3.5 h-3.5 text-purple-400" />;
      case 'UPDATED':
        return <Edit3 className="w-3.5 h-3.5 text-cyan-400" />;
      case 'COMMENT_ADDED':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <History className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="app-container space-y-6 animate-fade-in">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Link
            to="/items"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
            title="Back to registry"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-400" />
                {item.team.name}
              </span>
              <span className="text-slate-600">·</span>
              <button
                onClick={copyItemId}
                className="text-[11px] font-mono text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
                title="Click to copy item ID"
              >
                <span>ID: {item.id.slice(0, 8)}...</span>
                {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
              </button>
              <span className="text-slate-600">·</span>
              <span className="text-[11px] font-mono px-2 py-0.2 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-500/30">
                v{item.version}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              {item.title}
            </h1>
          </div>
        </div>

        {/* Global Item Badges */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <PriorityBadge priority={item.priority} />
          <StatusBadge status={item.status} />
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700">
            {item.type}
          </span>
        </div>
      </div>

      {/* HTTP 409 Conflict Banner */}
      {conflictNotice && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/80 to-slate-900/90 border border-amber-500/80 text-amber-200 text-xs space-y-2.5 animate-fade-in shadow-2xl">
          <div className="flex items-center gap-2.5 font-bold text-amber-300 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 animate-bounce" />
            <span>Optimistic Concurrency Conflict Detected (HTTP 409)</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed max-w-3xl">
            {conflictNotice}
          </p>
          <div className="pt-1 flex items-center gap-3">
            <button
              onClick={handleRefreshConflict}
              className="btn-primary text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-none"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh to Latest Database Version</span>
            </button>
            <span className="text-[11px] text-amber-400/80 font-mono">
              Your edits have not overwritten newer team updates.
            </span>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Context, Workflow Actions & Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Item Description Card */}
          <div className="glass-panel p-6 border-slate-800/90 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Description & Incident Findings
              </h2>
              {isMember && (
                <button
                  onClick={openEditModal}
                  className="btn-secondary py-1 px-3 text-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Fields</span>
                </button>
              )}
            </div>

            <div className="text-slate-200 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed bg-slate-900/70 p-4 rounded-xl border border-slate-800/90">
              {item.description}
            </div>
          </div>

          {/* Operational Workflow Control Center */}
          <div className="glass-panel p-5 sm:p-6 border-slate-800/90 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                <span>Workflow State Machine Actions</span>
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                Current: <strong className="text-white">{item.status.replace('_', ' ')}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Claim Action */}
              {isUnassigned && item.status === 'OPEN' && isMember && (
                <button
                  onClick={() => claimMutation.mutate()}
                  disabled={claimMutation.isPending}
                  className="btn-claim"
                >
                  <HandMetal className="w-4 h-4" />
                  <span>Claim Unassigned Item (Atomic)</span>
                </button>
              )}

              {/* Progress: OPEN -> IN_PROGRESS */}
              {item.status === 'OPEN' && !isUnassigned && isMember && (
                <button
                  onClick={() => transitionMutation.mutate({ targetStatus: 'IN_PROGRESS' })}
                  disabled={transitionMutation.isPending}
                  className="btn-primary text-xs"
                >
                  <span>Start Progress</span>
                </button>
              )}

              {/* Progress: IN_PROGRESS -> AWAITING_APPROVAL */}
              {item.status === 'IN_PROGRESS' && isMember && (
                <button
                  onClick={() => transitionMutation.mutate({ targetStatus: 'AWAITING_APPROVAL' })}
                  disabled={transitionMutation.isPending}
                  className="btn-primary bg-purple-600 hover:bg-purple-500 text-xs"
                >
                  <Clock className="w-4 h-4" />
                  <span>Submit for Lead Approval</span>
                </button>
              )}

              {/* Direct Resolve: IN_PROGRESS -> RESOLVED */}
              {item.status === 'IN_PROGRESS' && isMember && (
                <button
                  onClick={() => transitionMutation.mutate({ targetStatus: 'RESOLVED' })}
                  disabled={transitionMutation.isPending}
                  className="btn-success text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Resolved</span>
                </button>
              )}

              {/* Approval Gates: AWAITING_APPROVAL -> RESOLVED (Lead / Admin only) */}
              {item.status === 'AWAITING_APPROVAL' && isLeadOrAdmin && (
                <>
                  <button
                    onClick={() =>
                      transitionMutation.mutate({
                        targetStatus: 'RESOLVED',
                        reason: 'Approved by operational team lead'
                      })
                    }
                    disabled={transitionMutation.isPending}
                    className="btn-success text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Work Item</span>
                  </button>

                  <button
                    onClick={() => setIsRejectModalOpen(true)}
                    disabled={transitionMutation.isPending}
                    className="btn-danger text-xs"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject / Return for Rework</span>
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
                  <CheckCircle2 className="w-4 h-4 text-slate-400" />
                  <span>Close Work Item</span>
                </button>
              )}

              {/* Reopen to IN_PROGRESS: RESOLVED -> IN_PROGRESS (Member, Lead, Admin) */}
              {item.status === 'RESOLVED' && isMember && (
                <button
                  onClick={() => transitionMutation.mutate({ targetStatus: 'IN_PROGRESS' })}
                  disabled={transitionMutation.isPending}
                  className="btn-secondary text-xs"
                >
                  <span>Reopen to In Progress</span>
                </button>
              )}

              {/* Reopen CLOSED: CLOSED -> OPEN (ADMIN only) */}
              {item.status === 'CLOSED' && isAdmin && (
                <button
                  onClick={() => transitionMutation.mutate({ targetStatus: 'OPEN' })}
                  disabled={transitionMutation.isPending}
                  className="btn-primary text-xs"
                >
                  <span>Reopen Closed Item (Admin Only)</span>
                </button>
              )}
            </div>

            {/* Role restriction explanation notices */}
            {item.status === 'AWAITING_APPROVAL' && !isLeadOrAdmin && (
              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-900/50 text-[11px] text-purple-300 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span>
                  This item is pending review. Transitions out of approval strictly require a <strong>LEAD</strong> or{' '}
                  <strong>ADMIN</strong> team role.
                </span>
              </div>
            )}

            {item.status === 'CLOSED' && !isAdmin && (
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>
                  This work item is closed. Reopening closed items requires <strong>ADMIN</strong> authority.
                </span>
              </div>
            )}
          </div>

          {/* Comments / Collaboration Section */}
          <div className="glass-panel p-6 border-slate-800/90 space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Collaboration & Diagnostic Notes ({comments?.length || 0})</span>
              </h2>
            </div>

            <div className="space-y-3">
              {comments?.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No comments yet. Post an operational diagnosis below.
                </div>
              ) : (
                comments?.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-950 border border-indigo-700/60 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                          {c.author.name[0]}
                        </div>
                        <span className="font-bold text-slate-200">{c.author.name}</span>
                      </div>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap pl-7">
                      {c.body}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Form */}
            {isMember && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (commentText.trim()) commentMutation.mutate(commentText);
                }}
                className="pt-3 border-t border-slate-800/80 space-y-2.5"
              >
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add diagnostic notes, crash stack traces, or operational instructions..."
                  className="input-field text-xs"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>Enter to submit note to immutable audit timeline</span>
                  <button
                    type="submit"
                    disabled={commentMutation.isPending || !commentText.trim()}
                    className="btn-primary text-xs py-1.5 px-3.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{commentMutation.isPending ? 'Posting...' : 'Post Note'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Specification Details & Activity Audit Timeline */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="glass-panel p-5 border-slate-800/90 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Operational Specs
            </h2>

            <div className="space-y-3 text-xs divide-y divide-slate-800/70">
              <div className="pt-2 flex justify-between items-center">
                <span className="text-slate-400">Assignee</span>
                <span className="text-slate-200 font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  {item.assignee?.name || <span className="text-amber-400 font-mono">Unassigned</span>}
                </span>
              </div>

              <div className="pt-2.5 flex justify-between items-center">
                <span className="text-slate-400">Created By</span>
                <span className="text-slate-300">{item.creator.name}</span>
              </div>

              <div className="pt-2.5 flex justify-between items-center">
                <span className="text-slate-400">Target Team</span>
                <span className="text-slate-300 font-medium">{item.team.name}</span>
              </div>

              <div className="pt-2.5 flex justify-between items-center">
                <span className="text-slate-400">Version Lock</span>
                <span className="font-mono text-indigo-400 font-bold">v{item.version}</span>
              </div>

              <div className="pt-2.5 flex justify-between items-center">
                <span className="text-slate-400">Created At</span>
                <span className="font-mono text-[11px] text-slate-400">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Audit Timeline */}
          <div className="glass-panel p-5 border-slate-800/90 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Audit Timeline ({activities?.length || 0})</span>
              </h2>
            </div>

            <div className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {activities?.map((act) => (
                <div key={act.id} className="relative text-xs space-y-1">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center ring-4 ring-slate-950">
                    {getEventIcon(act.eventType)}
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-200">{act.actor.name}</span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="font-mono text-[10px] text-indigo-400 font-semibold uppercase tracking-wide">
                    {act.eventType}
                  </div>

                  {act.metadata && (
                    <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/70 leading-normal">
                      {act.eventType === 'CLAIMED' && 'Claimed ownership and moved item to IN PROGRESS'}
                      {act.eventType === 'APPROVED' && 'Approved transition to RESOLVED'}
                      {act.eventType === 'REJECTED' && `Rejected item: "${act.metadata.reason || 'Rework required'}"`}
                      {act.eventType === 'TRANSITIONED' &&
                        `Transitioned: ${act.metadata.fromStatus} → ${act.metadata.toStatus}`}
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

      {/* Edit Modal with Optimistic Concurrency Control */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 sm:p-7 border-slate-700/80 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <span>Edit Work Item (v{item.version})</span>
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
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
                <label className="input-label" htmlFor="edit-title">
                  Title
                </label>
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
                <label className="input-label" htmlFor="edit-desc">
                  Description
                </label>
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

              <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-200">Optimistic Locking:</span> Requires version{' '}
                <code className="text-indigo-400 font-mono">v{item.version}</code>. If modified concurrently, this save
                will be safely rejected with HTTP 409 Conflict.
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

      {/* Reject / Return for Rework Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 border-slate-700/80 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                <span>Return for Rework</span>
              </h2>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Please specify why this work item is being returned to <strong>IN PROGRESS</strong>:
              </p>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="input-field text-xs"
                placeholder="Reason for returning to operator..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={transitionMutation.isPending || !rejectReason.trim()}
                onClick={() =>
                  transitionMutation.mutate({
                    targetStatus: 'IN_PROGRESS',
                    reason: rejectReason
                  })
                }
                className="btn-danger text-xs"
              >
                {transitionMutation.isPending ? 'Returning...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
