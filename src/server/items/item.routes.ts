import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';
import {
  createItemSchema,
  updateItemSchema,
  transitionItemSchema,
  addCommentSchema,
  listItemsQuerySchema
} from './item.schemas.js';
import * as itemService from './item.service.js';

export const itemRouter = Router();

itemRouter.use(authenticate);

// 1. Dashboard summary
itemRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await itemService.getDashboardMetrics(req.user!.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 2. List work items with filters & cursor pagination
itemRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = listItemsQuerySchema.parse(req.query);
    const result = await itemService.listWorkItems(req.user!.userId, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 3. Create work item (Idempotency-Key supported)
itemRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createItemSchema.parse(req.body);
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    const { item, idempotentReplay } = await itemService.createWorkItem(
      req.user!.userId,
      input,
      idempotencyKey
    );

    res.status(idempotentReplay ? 200 : 201).json(item);
  } catch (err) {
    next(err);
  }
});

// 4. Get single work item
itemRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const item = await itemService.getWorkItemById(req.user!.userId, req.params.id);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// 5. Update work item (Requires expected version)
itemRouter.patch('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = updateItemSchema.parse(req.body);
    const item = await itemService.updateWorkItem(
      req.user!.userId,
      req.params.id,
      input
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// 6. Claim work item (Atomic conditional update)
itemRouter.post('/:id/claim', async (req: AuthenticatedRequest, res, next) => {
  try {
    const item = await itemService.claimWorkItem(req.user!.userId, req.params.id);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// 7. Workflow transition (Enforces matrix, permissions, and version)
itemRouter.post('/:id/transition', async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = transitionItemSchema.parse(req.body);
    const item = await itemService.transitionWorkItem(
      req.user!.userId,
      req.params.id,
      input
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// 8. Activity timeline
itemRouter.get('/:id/activity', async (req: AuthenticatedRequest, res, next) => {
  try {
    const activity = await itemService.getActivityEvents(
      req.user!.userId,
      req.params.id
    );
    res.json(activity);
  } catch (err) {
    next(err);
  }
});

// 9. Comments
itemRouter.get('/:id/comments', async (req: AuthenticatedRequest, res, next) => {
  try {
    const comments = await itemService.getComments(
      req.user!.userId,
      req.params.id
    );
    res.json(comments);
  } catch (err) {
    next(err);
  }
});

itemRouter.post('/:id/comments', async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = addCommentSchema.parse(req.body);
    const comment = await itemService.addComment(
      req.user!.userId,
      req.params.id,
      input
    );
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});
