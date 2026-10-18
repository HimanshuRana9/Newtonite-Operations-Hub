import { z } from 'zod';
import { Priority, WorkItemType, WorkItemStatus } from '@prisma/client';

export const createItemSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(5000),
  type: z.nativeEnum(WorkItemType).default(WorkItemType.TASK),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  teamId: z.string().uuid('Valid team ID is required'),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional()
});

export const updateItemSchema = z.object({
  version: z.number().int().min(1, 'Current item version is required for optimistic concurrency control'),
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(5).max(5000).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional()
});

export const transitionItemSchema = z.object({
  version: z.number().int().min(1, 'Current item version is required'),
  targetStatus: z.nativeEnum(WorkItemStatus),
  reason: z.string().trim().max(500).optional()
});

export const addCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment body cannot be empty').max(3000)
});

export const listItemsQuerySchema = z.object({
  teamId: z.string().uuid().optional(),
  status: z.nativeEnum(WorkItemStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().optional(),
  search: z.string().trim().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type TransitionItemInput = z.infer<typeof transitionItemSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
