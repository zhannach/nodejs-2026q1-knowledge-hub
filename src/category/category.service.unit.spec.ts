import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DbService } from '../db/db.service';
import { CategoryService } from './category.service';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../common/errors';

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';

describe('CategoryService', () => {
  let service: CategoryService;
  let db: {
    category: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    user: {
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  const adminActor = { id: '1', login: 'admin', role: Role.ADMIN };
  const viewerActor = { id: '2', login: 'viewer', role: Role.VIEWER };

  beforeEach(async () => {
    db = {
      category: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        count: vi.fn(),
        findFirst: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoryService, { provide: DbService, useValue: db }],
    }).compile();

    service = module.get(CategoryService);
  });

  it('returns sorted categories', async () => {
    db.category.findMany.mockResolvedValue([
      { id: CATEGORY_ID, name: 'Zeta', description: 'Later' },
      { id: '2', name: 'Alpha', description: 'Earlier' },
    ]);

    const result = await service.getAll({ sortBy: 'name', order: 'asc' });

    expect(result).toEqual([
      { id: '2', name: 'Alpha', description: 'Earlier' },
      { id: CATEGORY_ID, name: 'Zeta', description: 'Later' },
    ]);
  });

  it('throws on malformed UUIDs', async () => {
    await expect(service.getById('bad-id')).rejects.toThrow(ValidationError);
  });

  it('throws when category is missing', async () => {
    db.category.findUnique.mockResolvedValue(null);

    await expect(service.getById(CATEGORY_ID)).rejects.toThrow(NotFoundError);
  });

  it('returns a category by id', async () => {
    db.category.findUnique.mockResolvedValue({
      id: CATEGORY_ID,
      name: 'Backend',
      description: 'Topics',
    });

    await expect(service.getById(CATEGORY_ID)).resolves.toEqual({
      id: CATEGORY_ID,
      name: 'Backend',
      description: 'Topics',
    });
  });

  it('forbids non-admin category management', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(
      service.create({ name: 'Backend', description: 'Topics' }, viewerActor),
    ).rejects.toThrow(ForbiddenError);
  });

  it('creates categories for admins', async () => {
    db.category.create.mockImplementation(async ({ data }) => data);

    const result = await service.create(
      { name: 'Backend', description: 'Topics' },
      adminActor,
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: 'Backend',
        description: 'Topics',
      }),
    );
  });

  it('throws on malformed UUIDs during update', async () => {
    await expect(
      service.update('bad-id', { name: 'Updated' }, adminActor),
    ).rejects.toThrow(ValidationError);
  });

  it('forbids non-admin category updates', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(
      service.update(CATEGORY_ID, { name: 'Updated' }, viewerActor),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws when updating a missing category', async () => {
    db.category.findUnique.mockResolvedValue(null);

    await expect(
      service.update(CATEGORY_ID, { name: 'Updated' }, adminActor),
    ).rejects.toThrow(NotFoundError);
  });

  it('updates an existing category', async () => {
    db.category.findUnique.mockResolvedValue({
      id: CATEGORY_ID,
      name: 'Backend',
      description: 'Topics',
    });
    db.category.update.mockResolvedValue({
      id: CATEGORY_ID,
      name: 'Updated',
      description: 'Topics',
    });

    await expect(
      service.update(CATEGORY_ID, { name: 'Updated' }, adminActor),
    ).resolves.toEqual({
      id: CATEGORY_ID,
      name: 'Updated',
      description: 'Topics',
    });
  });

  it('throws on malformed UUIDs during removal', async () => {
    await expect(service.remove('bad-id', adminActor)).rejects.toThrow(
      ValidationError,
    );
  });

  it('forbids non-admin category removal', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(service.remove(CATEGORY_ID, viewerActor)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('throws when removing a missing category', async () => {
    db.category.findUnique.mockResolvedValue(null);

    await expect(service.remove(CATEGORY_ID, adminActor)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('removes an existing category', async () => {
    db.category.findUnique.mockResolvedValue({
      id: CATEGORY_ID,
      name: 'Backend',
      description: 'Topics',
    });
    db.category.delete.mockResolvedValue(undefined);

    await expect(
      service.remove(CATEGORY_ID, adminActor),
    ).resolves.toBeUndefined();
    expect(db.category.delete).toHaveBeenCalledWith({
      where: { id: CATEGORY_ID },
    });
  });
});
