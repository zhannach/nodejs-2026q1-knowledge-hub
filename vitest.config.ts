import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.unit.spec.ts'],
    exclude: ['test/**', 'dist/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/**/*.service.ts',
        'src/**/*.guard.ts',
        'src/**/*.pipe.ts',
        'src/**/dto/*.ts',
        'src/utils.ts',
        'src/user/user.mapper.ts',
        'src/auth/bootstrap-admin.ts',
        'src/auth/auth.types.ts',
      ],
      exclude: [
        'src/**/*.unit.spec.ts',
        'src/**/*.controller.ts',
        'src/**/*.module.ts',
        'src/app.*',
        'src/main.ts',
        'src/db/**',
        'src/logger.middleware.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 85,
      },
    },
  },
});
