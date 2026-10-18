import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';

export const teamRouter = Router();

teamRouter.use(authenticate);

teamRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            _count: {
              select: {
                memberships: true,
                workItems: true
              }
            }
          }
        }
      },
      orderBy: { team: { name: 'asc' } }
    });

    const teams = memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      role: m.role,
      memberCount: m.team._count.memberships,
      itemCount: m.team._count.workItems
    }));

    res.json(teams);
  } catch (err) {
    next(err);
  }
});
