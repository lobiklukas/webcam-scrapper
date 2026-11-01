import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, count, eq, ilike } from 'drizzle-orm';
import { cam, location } from '@webcam-scrapper/db';
import type { ListWebcamsQuery, WebcamDto, WebcamSummaryDto } from '@webcam-scrapper/contracts/dto';
import { DB, type AppDatabase } from '../db/db.js';

/** Escapes LIKE wildcards so searching for `50%` looks for a literal `50%`. */
function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class WebcamsService {
	constructor(@Inject(DB) private readonly db: AppDatabase) {}

	/** Locations with their camera count, ordered by name. */
	list({ q, limit, offset }: ListWebcamsQuery): Promise<WebcamSummaryDto[]> {
		return this.db
			.select({
				id: location.id,
				originalId: location.originalId,
				name: location.name,
				long: location.long,
				lat: location.lat,
				camCount: count(cam.id)
			})
			.from(location)
			.leftJoin(cam, eq(cam.locationId, location.id))
			.where(q ? ilike(location.name, `%${escapeLike(q)}%`) : undefined)
			.groupBy(location.id)
			.orderBy(asc(location.name), asc(location.id))
			.limit(limit)
			.offset(offset);
	}

	async findOne(id: number): Promise<WebcamDto> {
		const [row] = await this.db
			.select({
				id: location.id,
				originalId: location.originalId,
				name: location.name,
				long: location.long,
				lat: location.lat
			})
			.from(location)
			.where(eq(location.id, id))
			.limit(1);

		if (!row) throw new NotFoundException(`Webcam ${id} not found`);

		const cams = await this.db
			.select({
				id: cam.id,
				originalId: cam.originalId,
				retrievalUrl: cam.retrievalUrl,
				inCollection: cam.inCollection
			})
			.from(cam)
			.where(eq(cam.locationId, id))
			.orderBy(asc(cam.originalId));

		return { ...row, camCount: cams.length, cams };
	}
}
