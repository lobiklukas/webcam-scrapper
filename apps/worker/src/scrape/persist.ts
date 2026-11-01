import { eq } from 'drizzle-orm';
import { cam, frame, pollAttempt, type Database } from '@webcam-scrapper/db';
import type { Storage } from '../storage.js';
import { frameKey } from './key.js';
import type { ClaimedCam, FetchedImage, PollFailure } from './types.js';

const MAX_FAILURES = 8;
const MAX_BACKOFF_S = 3600;

export interface PersistDeps {
	db: Database;
	storage: Storage;
}

export type PollRecord =
	| { kind: 'stored'; image: FetchedImage }
	| { kind: 'unchanged'; httpStatus?: number; bytes?: number }
	| { kind: 'stale'; capturedAt: Date; httpStatus?: number; bytes?: number }
	| { kind: 'failed'; status: PollFailure; httpStatus?: number; error: string };

export interface StoredFrame {
	frameId: string;
	storageKey: string;
}

type CamPatch = Partial<typeof cam.$inferInsert>;

function failurePatch(target: ClaimedCam): CamPatch {
	const failureCount = target.failureCount + 1;
	const backoffS = Math.min(target.pollIntervalS * 2 ** Math.min(failureCount, 4), MAX_BACKOFF_S);

	return {
		failureCount,
		nextPollAt: new Date(Date.now() + backoffS * 1000),
		enabled: failureCount < MAX_FAILURES
	};
}

function camPatchFor(target: ClaimedCam, record: PollRecord): CamPatch | null {
	if (record.kind === 'stored') {
		return {
			lastSha256: record.image.sha256,
			lastEtag: record.image.etag ?? null,
			lastModified: record.image.lastModified ?? null,
			lastOkAt: new Date(),
			lastFrameAt: record.image.capturedAt,
			failureCount: 0
		};
	}

	if (record.kind === 'unchanged') return { lastOkAt: new Date(), failureCount: 0 };
	if (record.kind === 'failed') return failurePatch(target);

	return null;
}

function statusFor(record: PollRecord, inserted: boolean): string {
	if (record.kind === 'failed') return record.status;
	if (record.kind === 'stored') return inserted ? 'ok' : 'unchanged';

	return record.kind;
}

function attemptFor(input: {
	camId: number;
	record: PollRecord;
	status: string;
	startedAt: Date;
	durationMs: number;
}): typeof pollAttempt.$inferInsert {
	const base = {
		camId: input.camId,
		startedAt: input.startedAt,
		durationMs: input.durationMs,
		status: input.status
	};

	if (input.record.kind === 'stored') {
		return {
			...base,
			httpStatus: input.record.image.httpStatus,
			bytes: input.record.image.bytes.byteLength,
			error: null
		};
	}

	return {
		...base,
		httpStatus: input.record.httpStatus ?? null,
		bytes: input.record.kind === 'failed' ? null : (input.record.bytes ?? null),
		error: input.record.kind === 'failed' ? input.record.error : null
	};
}

export async function recordPoll(
	deps: PersistDeps,
	input: { cam: ClaimedCam; record: PollRecord; startedAt: Date; durationMs: number }
): Promise<StoredFrame | null> {
	const { cam: target, record, startedAt, durationMs } = input;
	const image = record.kind === 'stored' ? record.image : null;

	const storageKey = image
		? frameKey({
				camId: target.id,
				capturedAt: image.capturedAt,
				sha256: image.sha256,
				ext: image.ext
			})
		: null;

	if (image && storageKey) await deps.storage.put(storageKey, image.bytes, image.contentType);

	return deps.db.transaction(async (tx) => {
		const [inserted] =
			image && storageKey
				? await tx
						.insert(frame)
						.values({
							camId: target.id,
							capturedAt: image.capturedAt,
							storageKey,
							sha256: image.sha256,
							bytes: image.bytes.byteLength,
							contentType: image.contentType,
							etag: image.etag ?? null,
							lastModified: image.lastModified ?? null
						})
						.onConflictDoNothing()
						.returning({ id: frame.id })
				: [];

		const status = statusFor(record, Boolean(inserted));

		await tx
			.insert(pollAttempt)
			.values(attemptFor({ camId: target.id, record, status, startedAt, durationMs }));

		const patch = camPatchFor(target, record);
		if (patch) await tx.update(cam).set(patch).where(eq(cam.id, target.id));

		return inserted && storageKey ? { frameId: inserted.id, storageKey } : null;
	});
}
