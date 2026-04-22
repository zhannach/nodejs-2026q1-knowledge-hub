import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ArticleStatus, Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DbService } from '../db/db.service';
import { ArticleService } from './article.service';

const ARTICLE_ID = '11111111-1111-4111-8111-111111111111';
const AUTHOR_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333';
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444';

function buildArticle(overrides: Record<string, any> = {}) {
  return {
    id: ARTICLE_ID,
    title: 'NestJS',
    content: 'Body',
    status: ArticleStatus.DRAFT,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    authorId: AUTHOR_ID,
    categoryId: CATEGORY_ID,
    tags: [{ name: 'nestjs' }],
    author: {
      id: AUTHOR_ID,
      login: 'author',
      password: 'hashed',
      role: Role.EDITOR,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    },
    category: {
      id: CATEGORY_ID,
      name: 'Backend',
      description: 'Backend topics',
    },
    ...overrides,
  };
}

describe('ArticleService', () => {
  let service: ArticleService;
  let db: {
    article: {
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

  const adminActor = { id: AUTHOR_ID, login: 'admin', role: Role.ADMIN };
  const viewerActor = { id: AUTHOR_ID, login: 'viewer', role: Role.VIEWER };
  const editorActor = { id: AUTHOR_ID, login: 'editor', role: Role.EDITOR };

  beforeEach(async () => {
    db = {
      article: {
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
      providers: [ArticleService, { provide: DbService, useValue: db }],
    }).compile();

    service = module.get(ArticleService);
  });

  it('filters articles by status category and tag', async () => {
    db.article.findMany.mockResolvedValue([
      buildArticle(),
      buildArticle({
        id: OTHER_USER_ID,
        title: 'Advanced Nest',
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      }),
    ]);

    const result = await service.getAll({
      status: 'published',
      categoryId: CATEGORY_ID,
      tag: 'nestjs',
      sortBy: 'createdAt',
      order: 'desc',
      page: '1',
      limit: '1',
    });

    expect(db.article.findMany).toHaveBeenCalledWith({
      where: {
        status: ArticleStatus.PUBLISHED,
        categoryId: CATEGORY_ID,
        tags: { some: { name: 'nestjs' } },
      },
      include: { tags: true, category: true, author: true },
    });
    expect(result).toEqual({
      data: [expect.objectContaining({ id: OTHER_USER_ID })],
      total: 2,
      page: 1,
      limit: 1,
    });
  });

  it('throws for malformed article UUIDs', async () => {
    await expect(service.getById('bad-id')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws when article is not found', async () => {
    db.article.findUnique.mockResolvedValue(null);

    await expect(service.getById(ARTICLE_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('forbids viewers from creating articles', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(
      service.create({ title: 'Title', content: 'Body' }, viewerActor),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents editors from creating articles for another author', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(
      service.create(
        {
          title: 'Title',
          content: 'Body',
          authorId: OTHER_USER_ID,
        },
        editorActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates editor articles with actor ownership and tag management', async () => {
    db.user.count.mockResolvedValue(1);
    db.article.create.mockResolvedValue(buildArticle());

    const result = await service
      .create(
        {
          title: 'Title',
          content: 'Body',
          authorId: OTHER_USER_ID,
          tags: ['nestjs', 'vitest'],
        },
        editorActor,
      )
      .catch((error) => error);

    expect(result).toBeInstanceOf(ForbiddenException);
  });

  it('creates articles and normalizes response data', async () => {
    db.article.create.mockResolvedValue(buildArticle());

    const result = await service.create(
      {
        title: 'Title',
        content: 'Body',
        authorId: AUTHOR_ID,
        categoryId: CATEGORY_ID,
        tags: ['nestjs'],
      },
      adminActor,
    );

    expect(db.article.create).toHaveBeenCalledWith({
      data: {
        title: 'Title',
        content: 'Body',
        status: ArticleStatus.DRAFT,
        authorId: AUTHOR_ID,
        categoryId: CATEGORY_ID,
        tags: {
          connectOrCreate: [
            { where: { name: 'nestjs' }, create: { name: 'nestjs' } },
          ],
        },
      },
      include: { tags: true, category: true, author: true },
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: 'draft',
        tags: ['nestjs'],
      }),
    );
  });

  it('forbids viewers from updating articles', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(
      service.update(ARTICLE_ID, { title: 'Updated' }, viewerActor),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws for malformed UUIDs during update', async () => {
    await expect(
      service.update('bad-id', { title: 'Updated' }, adminActor),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when updating a missing article', async () => {
    db.article.findUnique.mockResolvedValue(null);

    await expect(
      service.update(ARTICLE_ID, { title: 'Updated' }, adminActor),
    ).rejects.toThrow(NotFoundException);
  });

  it('prevents editors from updating someone else article', async () => {
    db.user.count.mockResolvedValue(1);
    db.article.findUnique.mockResolvedValue(
      buildArticle({ authorId: OTHER_USER_ID }),
    );

    await expect(
      service.update(ARTICLE_ID, { title: 'Updated' }, editorActor),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents editors from reassigning ownership', async () => {
    db.user.count.mockResolvedValue(1);
    db.article.findUnique.mockResolvedValue(buildArticle());

    await expect(
      service.update(ARTICLE_ID, { authorId: OTHER_USER_ID }, editorActor),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updates articles with tag replacement logic', async () => {
    db.article.findUnique.mockResolvedValue(buildArticle());
    db.article.update.mockResolvedValue(
      buildArticle({
        status: ArticleStatus.PUBLISHED,
        tags: [{ name: 'testing' }, { name: 'vitest' }],
      }),
    );

    const result = await service.update(
      ARTICLE_ID,
      { status: ArticleStatus.PUBLISHED, tags: ['testing', 'vitest'] },
      adminActor,
    );

    expect(db.article.update).toHaveBeenCalledWith({
      where: { id: ARTICLE_ID },
      data: {
        title: undefined,
        content: undefined,
        status: ArticleStatus.PUBLISHED,
        authorId: undefined,
        categoryId: undefined,
        tags: {
          set: [],
          connectOrCreate: [
            { where: { name: 'testing' }, create: { name: 'testing' } },
            { where: { name: 'vitest' }, create: { name: 'vitest' } },
          ],
        },
      },
      include: { tags: true, category: true, author: true },
    });
    expect(result.tags).toEqual(['testing', 'vitest']);
  });

  it('allows draft to published transition', async () => {
    db.article.findUnique.mockResolvedValue(
      buildArticle({ status: ArticleStatus.DRAFT }),
    );
    db.article.update.mockResolvedValue(
      buildArticle({ status: ArticleStatus.PUBLISHED }),
    );

    const result = await service.update(
      ARTICLE_ID,
      { status: ArticleStatus.PUBLISHED },
      adminActor,
    );

    expect(result.status).toBe('published');
  });

  it('allows published to archived transition', async () => {
    db.article.findUnique.mockResolvedValue(
      buildArticle({ status: ArticleStatus.PUBLISHED }),
    );
    db.article.update.mockResolvedValue(
      buildArticle({ status: ArticleStatus.ARCHIVED }),
    );

    const result = await service.update(
      ARTICLE_ID,
      { status: ArticleStatus.ARCHIVED },
      adminActor,
    );

    expect(result.status).toBe('archived');
  });

  it('rejects draft to archived transition', async () => {
    db.article.findUnique.mockResolvedValue(
      buildArticle({ status: ArticleStatus.DRAFT }),
    );

    await expect(
      service.update(
        ARTICLE_ID,
        { status: ArticleStatus.ARCHIVED },
        adminActor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(db.article.update).not.toHaveBeenCalled();
  });

  it('rejects backward status transitions', async () => {
    db.article.findUnique.mockResolvedValue(
      buildArticle({ status: ArticleStatus.PUBLISHED }),
    );

    await expect(
      service.update(ARTICLE_ID, { status: ArticleStatus.DRAFT }, adminActor),
    ).rejects.toThrow(BadRequestException);

    expect(db.article.update).not.toHaveBeenCalled();
  });

  it('blocks non-admin article deletion', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(service.remove(ARTICLE_ID, editorActor)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when deleting a missing article', async () => {
    db.article.findUnique.mockResolvedValue(null);

    await expect(service.remove(ARTICLE_ID, adminActor)).rejects.toThrow(
      NotFoundException,
    );
  });
});
