import { sql } from 'drizzle-orm';
import type { Database } from '@webcam-scrapper/db';
import type { ClaimedCam } from './types.js';

type ClaimRow = {
	id: number;
	retrieval_url: string;
	poll_interval_s: number;
	failure_count: number;
	last_sha256: string | null;
	last_etag: string | null;
	last_modified: string | null;
	last_frame_at: Date | string | null;
};

export async function claimDueCams(db: Database, limit: number): Promise<ClaimedCam[]> {
	const rows = await db.execute<ClaimRow>(sql`
		UPDATE cam
		SET next_poll_at = now() + make_interval(secs => cam.poll_interval_s)
		WHERE cam.id IN (
			SELECT id FROM cam
			WHERE enabled
				AND retrieval_url IS NOT NULL
				AND next_poll_at <= now()
			ORDER BY next_poll_at
			LIMIT ${limit}
			FOR UPDATE SKIP LOCKED
		)
		RETURNING
			cam.id,
			cam.retrieval_url,
			cam.poll_interval_s,
			cam.failure_count,
			cam.last_sha256,
			cam.last_etag,
			cam.last_modified,
			cam.last_frame_at
	`);

	return Array.from(rows, (row) => ({
		id: row.id,
		retrievalUrl: row.retrieval_url,
		pollIntervalS: row.poll_interval_s,
		failureCount: row.failure_count,
		lastSha256: row.last_sha256,
		lastEtag: row.last_etag,
		lastModified: row.last_modified,
		lastFrameAt: row.last_frame_at ? new Date(row.last_frame_at) : null
	}));
}

export async function scrapeStats(db: Database): Promise<{ total: number; due: number }> {
	const rows = await db.execute<{ total: number; due: number }>(sql`
		SELECT
			count(*)::int AS total,
			count(*) FILTER (
				WHERE enabled AND retrieval_url IS NOT NULL AND next_poll_at <= now()
			)::int AS due
		FROM cam
	`);

	const row = rows[0];

	return { total: row?.total ?? 0, due: row?.due ?? 0 };
}
