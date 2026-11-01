import { z } from 'zod';
import { framePreviewDto } from './frames.js';

/** One camera view published on a location. */
export const camDto = z.object({
	id: z.number().int(),
	originalId: z.string(),
	retrievalUrl: z.string().nullable(),
	inCollection: z.boolean()
});

export type CamDto = z.infer<typeof camDto>;

/** A location (camera site) as it appears in the map/list view. */
export const webcamSummaryDto = z.object({
	id: z.number().int(),
	/**
	 * The provider the site was seeded from (`digitraffic`, `caltrans`, `tfl`, `foto-webcam`), which
	 * is what tells two sites with the same `originalId` apart and what the tile credits.
	 */
	source: z.string(),
	originalId: z.string(),
	name: z.string(),
	/** Longitude in decimal degrees, WGS 84. */
	long: z.number(),
	/** Latitude in decimal degrees, WGS 84. */
	lat: z.number(),
	camCount: z.number().int().nonnegative()
});

export type WebcamSummaryDto = z.infer<typeof webcamSummaryDto>;

/**
 * A location in the grid: the summary, the one camera chosen as its representative and that
 * camera's newest frame. `cam` and `frame` are null when a location has no camera or no frame yet.
 */
export const webcamListItemDto = webcamSummaryDto.extend({
	cam: camDto.nullable(),
	frame: framePreviewDto.nullable()
});

export type WebcamListItemDto = z.infer<typeof webcamListItemDto>;

/** A location plus the camera views it carries. */
export const webcamDto = webcamSummaryDto.extend({ cams: z.array(camDto) });

export type WebcamDto = z.infer<typeof webcamDto>;

/**
 * `q` matches the station name as a case-insensitive substring, `source` keeps one provider id.
 */
export const listWebcamsQueryDto = z.object({
	q: z.string().trim().max(100).optional(),
	source: z.string().trim().max(100).optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	offset: z.coerce.number().int().min(0).default(0)
});

/** One provider id (`location.source`), as offered by the provider filter. */
export const webcamSourceDto = z.string();

export type WebcamSourceDto = z.infer<typeof webcamSourceDto>;

export type ListWebcamsQuery = z.infer<typeof listWebcamsQueryDto>;

export const webcamIdParamDto = z.coerce.number().int().positive();
