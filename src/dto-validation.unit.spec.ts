import { plainToInstance } from 'class-transformer';
import { validate, validateOrReject } from 'class-validator';
import { ArticleStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { CreateArticleDto } from './article/dto/create-article.dto';
import { UpdateArticleDto } from './article/dto/update-article.dto';
import { AuthCredentialsDto } from './auth/dto/auth-credentials.dto';
import { RefreshTokenDto } from './auth/dto/refresh-token.dto';
import { CreateCategoryDto } from './category/dto/create-category.dto';
import { UpdateCategoryDto } from './category/dto/update-category.dto';
import { CreateCommentDto } from './comment/dto/create-comment.dto';
import { CreateUserDto } from './user/dto/create-user.dto';
import { UpdatePasswordDto } from './user/dto/update-password.dto';
import { UpdateUserDto } from './user/dto/update-user.dto';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('DTO validation', () => {
  it('fails when required fields are missing', async () => {
    const errors = await validate(Object.assign(new CreateUserDto(), {}));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails on invalid enum values', async () => {
    const userErrors = await validate(
      plainToInstance(CreateUserDto, {
        login: 'alice',
        password: 'secret',
        role: 'owner',
      }),
    );
    const articleErrors = await validate(
      plainToInstance(CreateArticleDto, {
        title: 'Title',
        content: 'Body',
        status: 'live',
      }),
    );
    const updateUserErrors = await validate(
      plainToInstance(UpdateUserDto, { role: 'superadmin' }),
    );

    expect(userErrors.some((error) => error.property === 'role')).toBe(true);
    expect(articleErrors.some((error) => error.property === 'status')).toBe(
      true,
    );
    expect(updateUserErrors.some((error) => error.property === 'role')).toBe(
      true,
    );
  });

  it('passes validation for valid payloads', async () => {
    await expect(
      validateOrReject(
        plainToInstance(CreateUserDto, {
          login: 'alice',
          password: 'secret',
          role: 'editor',
        }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      validateOrReject(
        plainToInstance(CreateArticleDto, {
          title: 'Title',
          content: 'Body',
          status: 'published',
          authorId: UUID_A,
          categoryId: UUID_B,
          tags: ['nestjs'],
        }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      validateOrReject(
        plainToInstance(UpdateArticleDto, { status: ArticleStatus.ARCHIVED }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      validateOrReject(
        plainToInstance(CreateCommentDto, {
          content: 'Nice article',
          articleId: UUID_A,
          authorId: UUID_B,
        }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      validateOrReject(
        plainToInstance(CreateCategoryDto, {
          name: 'Backend',
          description: 'Topics',
        }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      validateOrReject(
        plainToInstance(UpdateCategoryDto, { description: 'Updated' }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      validateOrReject(
        plainToInstance(UpdatePasswordDto, {
          oldPassword: 'old-secret',
          newPassword: 'new-secret',
        }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      validateOrReject(
        plainToInstance(UpdateUserDto, {
          oldPassword: 'old-secret',
          newPassword: 'new-secret',
          role: 'viewer',
        }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      validateOrReject(
        plainToInstance(AuthCredentialsDto, {
          login: 'alice',
          password: 'secret',
        }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      validateOrReject(
        plainToInstance(RefreshTokenDto, { refreshToken: 'token' }),
      ),
    ).resolves.toBeUndefined();
  });
});
