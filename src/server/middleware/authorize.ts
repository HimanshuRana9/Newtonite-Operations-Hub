import { Role } from '@prisma/client';
import { prisma } from '../db.js';

const ROLE_PRIORITY: Record<Role, number> = {
  VIEWER: 1,
  MEMBER: 2,
  LEAD: 3,
  ADMIN: 4
};

export function hasMinimumRole(userRole: Role, minimumRole: Role): boolean {
  return ROLE_PRIORITY[userRole] >= ROLE_PRIORITY[minimumRole];
}

export async function getUserTeamMembership(userId: string, teamId: string) {
  return prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId
      }
    },
    include: {
      team: true
    }
  });
}

export async function assertTeamPermission(
  userId: string,
  teamId: string,
  minimumRole: Role = Role.VIEWER
): Promise<Role> {
  const membership = await getUserTeamMembership(userId, teamId);

  if (!membership) {
    const error = new Error('Forbidden: You are not a member of this team');
    (error as any).statusCode = 403;
    throw error;
  }

  if (!hasMinimumRole(membership.role, minimumRole)) {
    const error = new Error(
      `Forbidden: Action requires at least ${minimumRole} role, but you have ${membership.role}`
    );
    (error as any).statusCode = 403;
    throw error;
  }

  return membership.role;
}
