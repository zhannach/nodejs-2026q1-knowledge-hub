import { PrismaClient, Role, ArticleStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.create({
    data: {
      login: 'admin_user',
      password: 'password123',
      role: Role.ADMIN,
    },
  });

  const editor = await prisma.user.create({
    data: {
      login: 'editor_user',
      password: 'password123',
      role: Role.EDITOR,
    },
  });

  const cat1 = await prisma.category.create({
    data: { name: 'Technology', description: 'Tech related' },
  });
  const cat2 = await prisma.category.create({
    data: { name: 'Science', description: 'Science related' },
  });
  const cat3 = await prisma.category.create({
    data: { name: 'Health', description: 'Health related' },
  });

  const tags = ['Tech', 'Life', 'Future', 'Space', 'Innovation'];

  const article1 = await prisma.article.create({
    data: {
      title: 'First Article',
      content: 'This is the first article',
      status: ArticleStatus.PUBLISHED,
      authorId: admin.id,
      categoryId: cat1.id,
      tags: {
        connectOrCreate: tags.slice(0, 2).map((t) => ({
          where: { name: t },
          create: { name: t },
        })),
      },
    },
  });

  const article2 = await prisma.article.create({
    data: {
      title: 'Second Article',
      content: 'This is the second article',
      status: ArticleStatus.DRAFT,
      authorId: editor.id,
      categoryId: cat2.id,
      tags: {
        connectOrCreate: tags.slice(2, 4).map((t) => ({
          where: { name: t },
          create: { name: t },
        })),
      },
    },
  });

  await prisma.article.create({
    data: {
      title: 'Third Article',
      content: 'This is the third article',
      status: ArticleStatus.ARCHIVED,
      authorId: admin.id,
      categoryId: cat3.id,
      tags: {
        connectOrCreate: tags.slice(1, 3).map((t) => ({
          where: { name: t },
          create: { name: t },
        })),
      },
    },
  });

  const article4 = await prisma.article.create({
    data: {
      title: 'Fourth Article',
      content: 'This is the fourth article',
      status: ArticleStatus.PUBLISHED,
      authorId: editor.id,
      categoryId: cat1.id,
      tags: {
        connectOrCreate: tags.slice(3, 5).map((t) => ({
          where: { name: t },
          create: { name: t },
        })),
      },
    },
  });

  await prisma.article.create({
    data: {
      title: 'Fifth Article',
      content: 'This is the fifth article',
      status: ArticleStatus.PUBLISHED,
      authorId: admin.id,
      categoryId: cat2.id,
      tags: {
        connectOrCreate: tags.slice(0, 5).map((t) => ({
          where: { name: t },
          create: { name: t },
        })),
      },
    },
  });

  await prisma.comment.create({
    data: {
      content: 'Great post!',
      authorId: admin.id,
      articleId: article1.id,
    },
  });

  await prisma.comment.create({
    data: {
      content: 'Interesting points.',
      authorId: editor.id,
      articleId: article2.id,
    },
  });

  await prisma.comment.create({
    data: {
      content: 'I agree with this completely.',
      authorId: admin.id,
      articleId: article4.id,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
