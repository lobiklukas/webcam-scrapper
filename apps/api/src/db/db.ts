import { getDrizzleToken } from '@nestjs/drizzle';
import type { Database } from '@webcam-scrapper/db';

/**
 * Injection token of the drizzle client that `DrizzleModule` registers in `AppModule`.
 * Feature modules inject this instead of importing the Nest library directly, so the
 * driver/module choice stays in one place.
 */
export const DB = getDrizzleToken();

/** Schema-aware drizzle client. */
export type AppDatabase = Database;
