import { z } from 'zod';

/** Liveness payload; also the Swagger response schema. */
export const healthDto = z.object({
	status: z.literal('ok'),
	uptime: z.number().int().nonnegative(),
	timestamp: z.iso.datetime()
});

export type HealthDto = z.infer<typeof healthDto>;
