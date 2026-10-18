export type Role = 'VIEWER' | 'MEMBER' | 'LEAD' | 'ADMIN';
export type WorkItemType = 'TASK' | 'BUG' | 'INCIDENT' | 'FEATURE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type WorkItemStatus = 'OPEN' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'RESOLVED' | 'CLOSED';
export type ActivityEventType =
  | 'CREATED'
  | 'ASSIGNED'
  | 'CLAIMED'
  | 'UPDATED'
  | 'TRANSITIONED'
  | 'COMMENT_ADDED'
  | 'APPROVED'
  | 'REJECTED';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface TeamMembership {
  id: string;
  teamId: string;
  teamName: string;
  role: Role;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  memberships: TeamMembership[];
}

export interface Team {
  id: string;
  name: string;
  role: Role;
  memberCount: number;
  itemCount: number;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  type: WorkItemType;
  priority: Priority;
  status: WorkItemStatus;
  teamId: string;
  creatorId: string;
  assigneeId: string | null;
  dueDate: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  team: { id: string; name: string };
  creator: UserSummary;
  assignee: UserSummary | null;
}

export interface ActivityEvent {
  id: string;
  workItemId: string;
  actorId: string;
  eventType: ActivityEventType;
  metadata: any;
  createdAt: string;
  actor: UserSummary;
}

export interface Comment {
  id: string;
  workItemId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: UserSummary;
}

export interface DashboardMetrics {
  assignedToMe: WorkItem[];
  unassignedUrgent: WorkItem[];
  awaitingApproval: WorkItem[];
  counts: {
    myCount: number;
    urgentCount: number;
    approvalCount: number;
    openCount: number;
  };
}
