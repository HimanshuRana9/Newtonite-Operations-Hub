import { Router } from 'express';
import { loginSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user!.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
});
