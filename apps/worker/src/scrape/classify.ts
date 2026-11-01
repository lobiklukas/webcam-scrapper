import type { PollRecord } from './persist.js';
import type { ClaimedCam, FetchOutcome } from './types.js';

export function classify(target: ClaimedCam, outcome: FetchOutcome): PollRecord {
	if (outcome.kind === 'failed') {
		return {
			kind: 'failed',
			status: outcome.status,
			httpStatus: outcome.httpStatus,
			error: outcome.error
		};
	}

	if (outcome.kind === 'not_modified') return { kind: 'unchanged', httpStatus: 304 };

	if (outcome.sha256 === target.lastSha256) {
		return { kind: 'unchanged', httpStatus: outcome.httpStatus, bytes: outcome.bytes.byteLength };
	}

	if (target.lastFrameAt && outcome.capturedAt <= target.lastFrameAt) {
		return {
			kind: 'stale',
			capturedAt: outcome.capturedAt,
			httpStatus: outcome.httpStatus,
			bytes: outcome.bytes.byteLength
		};
	}

	return { kind: 'stored', image: outcome };
}
