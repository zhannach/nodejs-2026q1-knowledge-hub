export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export class User {
  id: string;
  login: string;
  password?: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}
