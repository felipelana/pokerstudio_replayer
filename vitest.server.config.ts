import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/server/**/*.test.ts'],
    // Several suites talk to the same PostgreSQL database and clear tables
    // between cases. Run the files one after another so they cannot wipe each
    // other's rows halfway through.
    fileParallelism: false,
  },
});
