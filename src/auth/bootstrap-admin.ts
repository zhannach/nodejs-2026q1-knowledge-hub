import { Role } from '@prisma/client';
import { DbService } from '../db/db.service';
import { AuthenticatedUser } from './auth.types';

// The local test flow bootstraps authorization from the first signed-up user.
// Until a real ADMIN exists in the database, treat that oldest user as the
// temporary admin so role assignment and admin-only endpoints are reachable.
export async function hasAdminPrivileges(
  db: DbService,
  actor: AuthenticatedUser,
) {
  if (actor.role === Role.ADMIN) {
    return true;
  }

  const adminCount = await db.user.count({
    where: { role: Role.ADMIN },
  });

  if (adminCount > 0) {
    return false;
  }

  const firstUser = await db.user.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  return firstUser?.id === actor.id;
}
