export interface ClaimedCam {
	id: number;
	retrievalUrl: string;
	pollIntervalS: number;
	failureCount: number;
	lastSha256: string | null;
	lastEtag: string | null;
	lastModified: string | null;
	lastFrameAt: Date | null;
}

export type PollFailure =
	| 'blocked_scheme'
	| 'ssrf_rejected'
	| 'http_error'
	| 'timeout'
	| 'too_large'
	| 'bad_content_type'
	| 'stale'
	| 'empty';

export type PollStatus = 'ok' | 'unchanged' | PollFailure;

export interface Validators {
	etag?: string;
	lastModified?: string;
}

export interface FetchedImage {
	bytes: Uint8Array;
	sha256: string;
	contentType: string;
	ext: string;
	capturedAt: Date;
	capturedAtSource: 'header' | 'fetch';
	etag?: string;
	lastModified?: string;
	httpStatus: number;
}

export type FetchOutcome =
	| { kind: 'not_modified'; httpStatus: 304 }
	| ({ kind: 'image' } & FetchedImage)
	| { kind: 'failed'; status: PollFailure; httpStatus?: number; error: string };

export interface PollPolicy {
	maxBytes: number;
	timeoutMs: number;
	maxRedirects: number;
	allowedContentTypes: readonly string[];
}
