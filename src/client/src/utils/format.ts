import { Role, TeamMembership } from '../types/index.js';

const RANK: Role[] = ['VIEWER', 'MEMBER', 'LEAD', 'ADMIN'];

export const highestRole = (memberships: TeamMembership[]): Role =>
  [...memberships].sort((a, b) => RANK.indexOf(b.role) - RANK.indexOf(a.role))[0]?.role ?? 'VIEWER';

export const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const formatRelative = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  }
  const d = Math.floor(s / 86400);
  return `${d} ${d === 1 ? 'day' : 'days'} ago`;
};

/** "AWAITING_APPROVAL" -> "AWAITING APPROVAL" (all underscores, not just the first). */
export const formatEnum = (value: string) => value.replace(/_/g, ' ');

/** Human-readable message for an API error, including Zod field details when present. */
export const apiErrorMessage = (err: any, fallback = 'Something went wrong'): string => {
  const details = Array.isArray(err?.details) ? err.details.map((d: any) => d.message).filter(Boolean).join(' ') : '';
  const base = err?.message || fallback;
  return details ? `${base}: ${details}` : base;
};
