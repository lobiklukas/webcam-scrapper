import { z } from 'zod';

/** Path of the route that streams a stored frame; the API builds preview URLs with it. */
export const framePath = (id: string): string => `/api/frames/${id}`;

/** The newest frame of a camera: enough to render a preview without loading the bytes. */
export const framePreviewDto = z.object({
	id: z.uuid(),
	capturedAt: z.iso.datetime(),
	contentType: z.string(),
	bytes: z.number().int().nonnegative(),
	url: z.string()
});

export type FramePreviewDto = z.infer<typeof framePreviewDto>;

/**
 * The frames of one camera inside a window, for the player. `limit` keeps the newest frames of the
 * window when there are more, because a time-lapse is watched from the end backwards.
 */
export const listFramesQueryDto = z.object({
	camId: z.coerce.number().int().positive(),
	/** ISO 8601 instant; omitted means no lower bound. */
	from: z.iso.datetime().optional(),
	/** ISO 8601 instant; omitted means no upper bound. */
	to: z.iso.datetime().optional(),
	limit: z.coerce.number().int().min(1).max(500).default(200)
});

export type ListFramesQuery = z.infer<typeof listFramesQueryDto>;

export const frameIdParamDto = z.uuid();
