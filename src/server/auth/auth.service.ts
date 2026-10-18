import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { LoginInput } from './auth.schemas.js';

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: {
      memberships: {
        include: {
          team: true
        }
      }
    }
  });

  if (!user || !user.active) {
    const error = new Error('Invalid email or password');
    (error as any).statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    (error as any).statusCode = 401;
    throw error;
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    name: user.name
  };

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        teamId: m.teamId,
        teamName: m.team.name,
        role: m.role
      }))
    }
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          team: true
        }
      }
    }
  });

  if (!user || !user.active) {
    const error = new Error('User not found or inactive');
    (error as any).statusCode = 401;
    throw error;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    memberships: user.memberships.map((m) => ({
      id: m.id,
      teamId: m.teamId,
      teamName: m.team.name,
      role: m.role
    }))
  };
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
