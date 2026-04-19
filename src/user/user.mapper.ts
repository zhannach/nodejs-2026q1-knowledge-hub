import { Role, User } from '@prisma/client';

export function sanitizeUser(user: User) {
  const rest: User = { ...user };
  delete rest.password;

  return {
    ...rest,
    role: user.role.toLowerCase() as Role,
    createdAt: user.createdAt.getTime(),
    updatedAt: user.updatedAt.getTime(),
  };
}
