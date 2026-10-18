import crypto from 'crypto';
import { Prisma, Role, WorkItemStatus, ActivityEventType, Priority } from '@prisma/client';
import { prisma } from '../db.js';
import { assertTeamPermission, getUserTeamMembership, hasMinimumRole } from '../middleware/authorize.js';
import {
  CreateItemInput,
  UpdateItemInput,
  TransitionItemInput,
  AddCommentInput,
  ListItemsQuery
} from './item.schemas.js';

// Explicit workflow transition matrix
// From -> Allowed Target Statuses & Minimum Role Required
export const WORKFLOW_TRANSITIONS: Record<
  WorkItemStatus,
  Partial<Record<WorkItemStatus, { minRole: Role }>>
> = {
  OPEN: {
    IN_PROGRESS: { minRole: Role.MEMBER }
  },
  IN_PROGRESS: {
    AWAITING_APPROVAL: { minRole: Role.MEMBER },
    RESOLVED: { minRole: Role.MEMBER }
  },
  AWAITING_APPROVAL: {
    RESOLVED: { minRole: Role.LEAD },      // Only Lead or Admin can approve
    IN_PROGRESS: { minRole: Role.LEAD }   // Only Lead or Admin can reject / return for changes
  },
  RESOLVED: {
    CLOSED: { minRole: Role.LEAD },       // Lead or Admin closes item
    IN_PROGRESS: { minRole: Role.MEMBER } // Reopen
  },
  CLOSED: {
    OPEN: { minRole: Role.ADMIN }         // Reopen closed item requires Admin
  }
};

export async function createWorkItem(
  userId: string,
  input: CreateItemInput,
  idempotencyKey?: string
) {
  // 1. Authorize: user must have at least MEMBER role in the target team
  await assertTeamPermission(userId, input.teamId, Role.MEMBER);

  // 2. If Idempotency-Key is provided, check for existing request
  const operation = 'CREATE_WORK_ITEM';
  let requestHash = '';

  if (idempotencyKey) {
    requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');

    const existingKey = await prisma.idempotencyKey.findUnique({
      where: {
        userId_operation_key: {
          userId,
          operation,
          key: idempotencyKey
        }
      }
    });

    if (existingKey) {
      if (existingKey.requestHash !== requestHash) {
        const error = new Error('Conflict: Idempotency-Key reuse detected with different request payload');
        (error as any).statusCode = 409;
        throw error;
      }
      // Idempotent replay: return cached original result
      return {
        item: existingKey.responseBody as any,
        idempotentReplay: true
      };
    }
  }

  // 3. Execute item creation, activity event, outbox event, and idempotency key in ONE transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.workItem.create({
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          priority: input.priority,
          status: WorkItemStatus.OPEN,
          teamId: input.teamId,
          creatorId: userId,
          assigneeId: input.assigneeId || null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          version: 1
        },
        include: {
          team: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } }
        }
      });

      // Transactional Activity Event
      await tx.activityEvent.create({
        data: {
          workItemId: item.id,
          actorId: userId,
          eventType: ActivityEventType.CREATED,
          metadata: {
            title: item.title,
            priority: item.priority,
            type: item.type,
            assigneeId: item.assigneeId
          }
        }
      });

      // Transactional Outbox Event (for downstream notifications)
      await tx.outboxEvent.create({
        data: {
          eventType: 'WORK_ITEM_CREATED',
          payload: {
            workItemId: item.id,
            title: item.title,
            teamId: item.teamId,
            priority: item.priority,
            creatorId: userId,
            assigneeId: item.assigneeId
          },
          status: 'PENDING'
        }
      });

      // If idempotencyKey supplied, persist it within the same transaction
      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            userId,
            operation,
            key: idempotencyKey,
            requestHash,
            responseStatus: 201,
            responseBody: item as any
          }
        });
      }

      return item;
    });

    return { item: result, idempotentReplay: false };
  } catch (err: any) {
    // If concurrent duplicate request won the race, handle P2002 on idempotency key
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && idempotencyKey) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: {
          userId_operation_key: {
            userId,
            operation,
            key: idempotencyKey
          }
        }
      });
      if (existing) {
        return { item: existing.responseBody as any, idempotentReplay: true };
      }
    }
    throw err;
  }
}

export async function getWorkItemById(userId: string, itemId: string) {
  const item = await prisma.workItem.findUnique({
    where: { id: itemId },
    include: {
      team: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } }
    }
  });

  if (!item) {
    const error = new Error('Work item not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Authorize against the item's team (caller must be at least VIEWER)
  await assertTeamPermission(userId, item.teamId, Role.VIEWER);

  return item;
}

export async function listWorkItems(userId: string, query: ListItemsQuery) {
  // Determine allowed teams for user
  const userMemberships = await prisma.membership.findMany({
    where: { userId },
    select: { teamId: true }
  });

  const authorizedTeamIds = userMemberships.map((m) => m.teamId);

  if (authorizedTeamIds.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  // Filter by requested team, ensuring it is within authorized teams
  let targetTeamIds: string[] = authorizedTeamIds;
  if (query.teamId) {
    if (!authorizedTeamIds.includes(query.teamId)) {
      const error = new Error('Forbidden: You are not a member of the requested team');
      (error as any).statusCode = 403;
      throw error;
    }
    targetTeamIds = [query.teamId];
  }

  // Build Prisma where conditions
  const where: Prisma.WorkItemWhereInput = {
    teamId: { in: targetTeamIds }
  };

  if (query.status) {
    where.status = query.status;
  }

  if (query.priority) {
    where.priority = query.priority;
  }

  if (query.assigneeId) {
    if (query.assigneeId === 'me') {
      where.assigneeId = userId;
    } else if (query.assigneeId === 'unassigned') {
      where.assigneeId = null;
    } else {
      where.assigneeId = query.assigneeId;
    }
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } }
    ];
  }

  // Stable Cursor Pagination based on (createdAt DESC, id DESC)
  if (query.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(query.cursor, 'base64').toString('utf-8'));
      where.AND = [
        {
          OR: [
            { createdAt: { lt: new Date(decoded.createdAt) } },
            {
              createdAt: new Date(decoded.createdAt),
              id: { lt: decoded.id }
            }
          ]
        }
      ];
    } catch {
      // Ignore malformed cursor, start from top
    }
  }

  const limit = query.limit || 20;

  const items = await prisma.workItem.findMany({
    where,
    take: limit + 1, // Fetch one extra to determine hasMore
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    include: {
      team: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } }
    }
  });

  const hasMore = items.length > limit;
  const pagedItems = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  if (hasMore && pagedItems.length > 0) {
    const lastItem = pagedItems[pagedItems.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({
        createdAt: lastItem.createdAt.toISOString(),
        id: lastItem.id
      })
    ).toString('base64');
  }

  return {
    items: pagedItems,
    nextCursor,
    hasMore
  };
}

export async function claimWorkItem(userId: string, itemId: string) {
  // 1. First fetch item to check team and authorization
  const item = await prisma.workItem.findUnique({
    where: { id: itemId }
  });

  if (!item) {
    const error = new Error('Work item not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // 2. Caller must have at least MEMBER role in the item's team
  await assertTeamPermission(userId, item.teamId, Role.MEMBER);

  // 3. Atomic conditional update via transaction using raw SQL with parameter bindings
  const result = await prisma.$transaction(async (tx) => {
    const updatedRows: any[] = await tx.$queryRaw`
      UPDATE work_items
      SET "assigneeId" = ${userId},
          status = 'IN_PROGRESS'::"WorkItemStatus",
          version = version + 1,
          "updatedAt" = NOW()
      WHERE id = ${itemId}
        AND "teamId" = ${item.teamId}
        AND "assigneeId" IS NULL
        AND status = 'OPEN'::"WorkItemStatus"
      RETURNING *;
    `;

    if (!updatedRows || updatedRows.length === 0) {
      // Check current state to explain conflict
      const current = await tx.workItem.findUnique({ where: { id: itemId } });
      if (!current) {
        const error = new Error('Work item not found');
        (error as any).statusCode = 404;
        throw error;
      }
      const error = new Error(
        `Conflict: Item cannot be claimed. Current status is ${current.status} and assignee is ${
          current.assigneeId ? (current.assigneeId === userId ? 'already you' : 'another user') : 'none'
        }`
      );
      (error as any).statusCode = 409;
      throw error;
    }

    const updatedItem = updatedRows[0];

    // Transactional activity event
    await tx.activityEvent.create({
      data: {
        workItemId: itemId,
        actorId: userId,
        eventType: ActivityEventType.CLAIMED,
        metadata: {
          previousStatus: WorkItemStatus.OPEN,
          newStatus: WorkItemStatus.IN_PROGRESS,
          assigneeId: userId,
          newVersion: updatedItem.version
        }
      }
    });

    // Transactional outbox event
    await tx.outboxEvent.create({
      data: {
        eventType: 'WORK_ITEM_CLAIMED',
        payload: {
          workItemId: itemId,
          assigneeId: userId,
          version: updatedItem.version
        },
        status: 'PENDING'
      }
    });

    return updatedItem;
  });

  return getWorkItemById(userId, itemId);
}

export async function updateWorkItem(
  userId: string,
  itemId: string,
  input: UpdateItemInput
) {
  const item = await prisma.workItem.findUnique({
    where: { id: itemId }
  });

  if (!item) {
    const error = new Error('Work item not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Caller must have at least MEMBER role
  const userRole = await assertTeamPermission(userId, item.teamId, Role.MEMBER);

  // If Member, verify permitted: either the assignee, creator, or Lead/Admin
  if (userRole === Role.MEMBER && item.assigneeId && item.assigneeId !== userId && item.creatorId !== userId) {
    const error = new Error('Forbidden: Members can only edit items they created or are assigned to');
    (error as any).statusCode = 403;
    throw error;
  }

  // Optimistic concurrency update
  const result = await prisma.$transaction(async (tx) => {
    const dueDateVal = input.dueDate ? new Date(input.dueDate) : input.dueDate === null ? null : item.dueDate;

    const updatedRows: any[] = await tx.$queryRaw`
      UPDATE work_items
      SET title = COALESCE(${input.title ?? null}, title),
          description = COALESCE(${input.description ?? null}, description),
          priority = COALESCE(${input.priority ? Prisma.raw(`'${input.priority}'::"Priority"`) : Prisma.raw('NULL')}, priority),
          "assigneeId" = ${input.assigneeId !== undefined ? input.assigneeId : item.assigneeId},
          "dueDate" = ${dueDateVal},
          version = version + 1,
          "updatedAt" = NOW()
      WHERE id = ${itemId}
        AND "teamId" = ${item.teamId}
        AND version = ${input.version}
      RETURNING *;
    `;

    if (!updatedRows || updatedRows.length === 0) {
      const current = await tx.workItem.findUnique({ where: { id: itemId } });
      if (!current) {
        const error = new Error('Work item not found');
        (error as any).statusCode = 404;
        throw error;
      }
      const error = new Error(
        `Conflict: Stale update. Your version is ${input.version}, but current version is ${current.version}. Please refresh.`
      );
      (error as any).statusCode = 409;
      throw error;
    }

    const updatedItem = updatedRows[0];

    // Transactional activity history
    await tx.activityEvent.create({
      data: {
        workItemId: itemId,
        actorId: userId,
        eventType: ActivityEventType.UPDATED,
        metadata: {
          previousVersion: input.version,
          newVersion: updatedItem.version,
          changes: {
            title: input.title,
            priority: input.priority,
            assigneeId: input.assigneeId
          }
        }
      }
    });

    return updatedItem;
  });

  return getWorkItemById(userId, itemId);
}

export async function transitionWorkItem(
  userId: string,
  itemId: string,
  input: TransitionItemInput
) {
  const item = await prisma.workItem.findUnique({
    where: { id: itemId }
  });

  if (!item) {
    const error = new Error('Work item not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Resolve user role in item's team
  const userRole = await assertTeamPermission(userId, item.teamId, Role.MEMBER);

  // Check state machine: is transition allowed from current status to target status?
  const allowedTransitions = WORKFLOW_TRANSITIONS[item.status];
  const rule = allowedTransitions ? allowedTransitions[input.targetStatus] : null;

  if (!rule) {
    const error = new Error(
      `Invalid workflow transition: Cannot move item from ${item.status} to ${input.targetStatus}`
    );
    (error as any).statusCode = 400;
    throw error;
  }

  // Check if caller's role meets the transition's required minimum role
  if (!hasMinimumRole(userRole, rule.minRole)) {
    const error = new Error(
      `Forbidden: Transitioning from ${item.status} to ${input.targetStatus} requires at least ${rule.minRole} role, but you are a ${userRole}`
    );
    (error as any).statusCode = 403;
    throw error;
  }

  // Execute version-checked update & activity record in ONE transaction
  const result = await prisma.$transaction(async (tx) => {
    const updatedRows: any[] = await tx.$queryRaw`
      UPDATE work_items
      SET status = ${input.targetStatus}::"WorkItemStatus",
          version = version + 1,
          "updatedAt" = NOW()
      WHERE id = ${itemId}
        AND "teamId" = ${item.teamId}
        AND version = ${input.version}
      RETURNING *;
    `;

    if (!updatedRows || updatedRows.length === 0) {
      const current = await tx.workItem.findUnique({ where: { id: itemId } });
      if (!current) {
        const error = new Error('Work item not found');
        (error as any).statusCode = 404;
        throw error;
      }
      const error = new Error(
        `Conflict: Stale update during transition. Provided version: ${input.version}, actual version: ${current.version}`
      );
      (error as any).statusCode = 409;
      throw error;
    }

    const updatedItem = updatedRows[0];
    const isApproval = input.targetStatus === WorkItemStatus.RESOLVED && item.status === WorkItemStatus.AWAITING_APPROVAL;
    const isRejection = input.targetStatus === WorkItemStatus.IN_PROGRESS && item.status === WorkItemStatus.AWAITING_APPROVAL;

    let eventType: ActivityEventType = ActivityEventType.TRANSITIONED;
    if (isApproval) eventType = ActivityEventType.APPROVED;
    if (isRejection) eventType = ActivityEventType.REJECTED;

    await tx.activityEvent.create({
      data: {
        workItemId: itemId,
        actorId: userId,
        eventType,
        metadata: {
          fromStatus: item.status,
          toStatus: input.targetStatus,
          reason: input.reason,
          newVersion: updatedItem.version
        }
      }
    });

    await tx.outboxEvent.create({
      data: {
        eventType: `WORK_ITEM_${eventType}`,
        payload: {
          workItemId: itemId,
          actorId: userId,
          fromStatus: item.status,
          toStatus: input.targetStatus,
          version: updatedItem.version
        },
        status: 'PENDING'
      }
    });

    return updatedItem;
  });

  return getWorkItemById(userId, itemId);
}

export async function addComment(
  userId: string,
  itemId: string,
  input: AddCommentInput
) {
  const item = await prisma.workItem.findUnique({
    where: { id: itemId }
  });

  if (!item) {
    const error = new Error('Work item not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Caller must be at least MEMBER in the item's team
  await assertTeamPermission(userId, item.teamId, Role.MEMBER);

  const result = await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        workItemId: itemId,
        authorId: userId,
        body: input.body
      },
      include: {
        author: { select: { id: true, name: true, email: true } }
      }
    });

    // Transactional activity event
    await tx.activityEvent.create({
      data: {
        workItemId: itemId,
        actorId: userId,
        eventType: ActivityEventType.COMMENT_ADDED,
        metadata: {
          commentId: comment.id,
          snippet: input.body.slice(0, 100)
        }
      }
    });

    return comment;
  });

  return result;
}

export async function getComments(userId: string, itemId: string) {
  const item = await prisma.workItem.findUnique({
    where: { id: itemId }
  });

  if (!item) {
    const error = new Error('Work item not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Authorize: at least VIEWER
  await assertTeamPermission(userId, item.teamId, Role.VIEWER);

  return prisma.comment.findMany({
    where: { workItemId: itemId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, email: true } }
    }
  });
}

export async function getActivityEvents(userId: string, itemId: string) {
  const item = await prisma.workItem.findUnique({
    where: { id: itemId }
  });

  if (!item) {
    const error = new Error('Work item not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Authorize: at least VIEWER
  await assertTeamPermission(userId, item.teamId, Role.VIEWER);

  return prisma.activityEvent.findMany({
    where: { workItemId: itemId },
    orderBy: { createdAt: 'desc' },
    include: {
      actor: { select: { id: true, name: true, email: true } }
    }
  });
}

export async function getDashboardMetrics(userId: string) {
  const userMemberships = await prisma.membership.findMany({
    where: { userId },
    select: { teamId: true }
  });

  const teamIds = userMemberships.map((m) => m.teamId);

  if (teamIds.length === 0) {
    return {
      assignedToMe: [],
      unassignedUrgent: [],
      awaitingApproval: [],
      counts: { myCount: 0, urgentCount: 0, approvalCount: 0, openCount: 0 }
    };
  }

  const [
    assignedToMe,
    unassignedUrgent,
    awaitingApproval,
    openCount,
    myCount,
    urgentCount,
    approvalCount
  ] = await Promise.all([
    prisma.workItem.findMany({
      where: {
        teamId: { in: teamIds },
        assigneeId: userId,
        status: { in: [WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS, WorkItemStatus.AWAITING_APPROVAL] }
      },
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } }
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 10
    }),
    prisma.workItem.findMany({
      where: {
        teamId: { in: teamIds },
        assigneeId: null,
        priority: { in: [Priority.URGENT, Priority.HIGH] },
        status: WorkItemStatus.OPEN
      },
      include: {
        team: { select: { id: true, name: true } }
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 10
    }),
    prisma.workItem.findMany({
      where: {
        teamId: { in: teamIds },
        status: WorkItemStatus.AWAITING_APPROVAL
      },
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } }
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 10
    }),
    prisma.workItem.count({
      where: {
        teamId: { in: teamIds },
        status: { in: [WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS] }
      }
    }),
    prisma.workItem.count({
      where: {
        teamId: { in: teamIds },
        assigneeId: userId,
        status: { in: [WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS, WorkItemStatus.AWAITING_APPROVAL] }
      }
    }),
    prisma.workItem.count({
      where: {
        teamId: { in: teamIds },
        assigneeId: null,
        priority: { in: [Priority.URGENT, Priority.HIGH] },
        status: WorkItemStatus.OPEN
      }
    }),
    prisma.workItem.count({
      where: {
        teamId: { in: teamIds },
        status: WorkItemStatus.AWAITING_APPROVAL
      }
    })
  ]);

  return {
    assignedToMe,
    unassignedUrgent,
    awaitingApproval,
    counts: {
      myCount,
      urgentCount,
      approvalCount,
      openCount
    }
  };
}
