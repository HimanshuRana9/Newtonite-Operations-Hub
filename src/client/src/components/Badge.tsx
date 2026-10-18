import React from 'react';
import { WorkItemStatus, Priority, Role } from '../types/index.js';
import { formatEnum } from '../utils/format.js';

interface StatusBadgeProps {
  status: WorkItemStatus | string;
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showDot = true,
  className = ''
}) => {
  const formatted = formatEnum(status);

  return (
    <span className={`badge-base badge-status-${status} ${className}`}>
      {showDot && <span className="status-dot" />}
      <span>{formatted}</span>
    </span>
  );
};

interface PriorityBadgeProps {
  priority: Priority | string;
  showDot?: boolean;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  showDot = true,
  className = ''
}) => {
  return (
    <span className={`badge-base badge-priority-${priority} ${className}`}>
      {showDot && <span className="status-dot" />}
      <span>{priority}</span>
    </span>
  );
};

interface RoleBadgeProps {
  role: Role | string;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
  return (
    <span
      className={`font-mono text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold badge-role-${role} ${className}`}
    >
      {role}
    </span>
  );
};
