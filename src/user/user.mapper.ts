import { User } from '@prisma/client';

export function sanitizeUser(user: User) {
  const rest: User = { ...user };
  delete rest.password;

  return {
    ...rest,
    role: user.role.toLowerCase(),
    createdAt: user.createdAt.getTime(),
    updatedAt: user.updatedAt.getTime(),
  };
}
