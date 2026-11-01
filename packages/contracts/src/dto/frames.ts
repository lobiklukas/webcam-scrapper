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

export const frameIdParamDto = z.uuid();
