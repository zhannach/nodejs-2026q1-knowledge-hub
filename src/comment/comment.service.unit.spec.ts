import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DbService } from '../db/db.service';
import { CommentService } from './comment.service';

const COMMENT_ID = '11111111-1111-4111-8111-111111111111';
const ARTICLE_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

describe('CommentService', () => {
  let service: CommentService;
  let db: {
    comment: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    article: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    user: {
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  const adminActor = { id: USER_ID, login: 'admin', role: Role.ADMIN };
  const viewerActor = { id: USER_ID, login: 'viewer', role: Role.VIEWER };
  const editorActor = { id: USER_ID, login: 'editor', role: Role.EDITOR };

  beforeEach(async () => {
    db = {
      comment: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      article: {
        findUnique: vi.fn(),
      },
      user: {
        count: vi.fn(),
        findFirst: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CommentService, { provide: DbService, useValue: db }],
    }).compile();

    service = module.get(CommentService);
  });

  it('requires articleId when listing comments', async () => {
    await expect(service.findAllByArticle({})).rejects.toThrow(BadRequestException);
  });

  it('rejects malformed article UUIDs in query', async () => {
    await expect(
      service.findAllByArticle({ articleId: 'bad-id' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns paginated comments for an article', async () => {
    db.comment.findMany.mockResolvedValue([
      {
        id: COMMENT_ID,
        content: 'First',
        articleId: ARTICLE_ID,
        authorId: USER_ID,
        author: {
          id: USER_ID,
          login: 'alice',
          password: 'hashed',
          role: Role.EDITOR,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        content: 'Second',
        articleId: ARTICLE_ID,
        authorId: USER_ID,
        author: {
          id: USER_ID,
          login: 'alice',
          password: 'hashed',
          role: Role.EDITOR,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.findAllByArticle({
      articleId: ARTICLE_ID,
      sortBy: 'createdAt',
      order: 'desc',
      page: '1',
      limit: '1',
    });

    expect(result).toEqual({
      data: [expect.objectContaining({ content: 'Second' })],
      total: 2,
      page: 1,
      limit: 1,
    });
  });

  it('throws for malformed comment UUIDs', async () => {
    await expect(service.getById('bad-id')).rejects.toThrow(BadRequestException);
  });

  it('throws when comment is not found', async () => {
    db.comment.findUnique.mockResolvedValue(null);

    await expect(service.getById(COMMENT_ID)).rejects.toThrow(NotFoundException);
  });

  it('forbids viewers from creating comments', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(
      service.create({ content: 'Nice post', articleId: ARTICLE_ID }, viewerActor),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents editors from creating comments for another author', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(
      service.create(
        { content: 'Nice post', articleId: ARTICLE_ID, authorId: 'other-user' },
        editorActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when article does not exist', async () => {
    db.article.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ content: 'Nice post', articleId: ARTICLE_ID }, adminActor),
    ).rejects.toThrow(HttpException);
  });

  it('creates comments and connects the author', async () => {
    db.article.findUnique.mockResolvedValue({ id: ARTICLE_ID });
    db.comment.create.mockResolvedValue({
      id: COMMENT_ID,
      content: 'Nice post',
      articleId: ARTICLE_ID,
      authorId: USER_ID,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const result = await service.create(
      { content: 'Nice post', articleId: ARTICLE_ID },
      editorActor,
    );

    expect(db.comment.create).toHaveBeenCalledWith({
      data: {
        content: 'Nice post',
        article: { connect: { id: ARTICLE_ID } },
        author: { connect: { id: USER_ID } },
      },
    });
    expect(typeof result.createdAt).toBe('number');
  });

  it('forbids non-admin comment deletion', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(service.remove(COMMENT_ID, editorActor)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when deleting a missing comment', async () => {
    db.comment.findUnique.mockResolvedValue(null);

    await expect(service.remove(COMMENT_ID, adminActor)).rejects.toThrow(
      NotFoundException,
    );
  });
});
