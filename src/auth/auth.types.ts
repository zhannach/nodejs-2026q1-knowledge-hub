import { Role } from '@prisma/client';
import { Request } from 'express';

export interface TokenPayload {
  userId: string;
  login: string;
  role: Role;
}

export interface AuthenticatedUser {
  id: string;
  login: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
