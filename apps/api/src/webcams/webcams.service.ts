import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, count, desc, eq, ilike, inArray } from 'drizzle-orm';
import { cam, frame, location } from '@webcam-scrapper/db';
import {
	framePath,
	type ListWebcamsQuery,
	type WebcamDto,
	type WebcamListItemDto
} from '@webcam-scrapper/contracts/dto';
import { DB, type AppDatabase } from '../db/db.js';

/** Escapes LIKE wildcards so searching for `50%` looks for a literal `50%`. */
function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class WebcamsService {
	constructor(@Inject(DB) private readonly db: AppDatabase) {}

	/**
	 * Locations ordered by name, each with its camera count, one representative camera and that
	 * camera's newest frame, which is what the grid renders as a preview. The representative camera
	 * is the first by `originalId` that already has a frame, so a location whose lowest-id view has
	 * not been polled yet still gets a preview from a sibling; with no frames at all it falls back to
	 * its first camera and `frame: null`.
	 */
	async list({ q, limit, offset }: ListWebcamsQuery): Promise<WebcamListItemDto[]> {
		const rows = await this.db.query.location.findMany({
			columns: { id: true, originalId: true, name: true, long: true, lat: true },
			where: q ? ilike(location.name, `%${escapeLike(q)}%`) : undefined,
			orderBy: [asc(location.name), asc(location.id)],
			limit,
			offset,
			with: {
				cam: {
					columns: { id: true, originalId: true, retrievalUrl: true, inCollection: true },
					orderBy: asc(cam.originalId),
					with: {
						frame: {
							columns: { id: true, capturedAt: true, contentType: true, bytes: true },
							orderBy: desc(frame.capturedAt),
							limit: 1
						}
					}
				}
			}
		});

		const camCounts = await this.countCams(rows.map(({ id }) => id));

		return rows.map(({ cam: cams, id, originalId, name, long, lat }) => {
			const selected = cams.find(({ frame: frames }) => frames.length > 0) ?? cams[0];
			const [latest] = selected?.frame ?? [];

			return {
				id,
				originalId,
				name,
				long,
				lat,
				camCount: camCounts.get(id) ?? 0,
				cam: selected
					? {
							id: selected.id,
							originalId: selected.originalId,
							retrievalUrl: selected.retrievalUrl,
							inCollection: selected.inCollection
						}
					: null,
				frame: latest
					? {
							id: latest.id,
							capturedAt: latest.capturedAt.toISOString(),
							contentType: latest.contentType,
							bytes: latest.bytes,
							url: framePath(latest.id)
						}
					: null
			};
		});
	}

	/** One location with every camera view it carries. */
	async findOne(id: number): Promise<WebcamDto> {
		const locationRow = await this.db.query.location.findFirst({
			columns: { id: true, originalId: true, name: true, long: true, lat: true },
			where: eq(location.id, id),
			with: {
				cam: {
					columns: { id: true, originalId: true, retrievalUrl: true, inCollection: true },
					orderBy: asc(cam.originalId)
				}
			}
		});

		if (!locationRow) throw new NotFoundException(`Webcam ${id} not found`);

		const { cam: cams, ...row } = locationRow;

		return { ...row, camCount: cams.length, cams };
	}

	private async countCams(locationIds: number[]): Promise<Map<number, number>> {
		if (locationIds.length === 0) return new Map();

		const rows = await this.db
			.select({ locationId: cam.locationId, camCount: count() })
			.from(cam)
			.where(inArray(cam.locationId, locationIds))
			.groupBy(cam.locationId);

		return new Map(rows.map(({ locationId, camCount }) => [locationId, camCount]));
	}
}
