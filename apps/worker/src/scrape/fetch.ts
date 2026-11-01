import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { detectImage } from './image.js';
import type { FetchOutcome, PollFailure, PollPolicy, Validators } from './types.js';

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function isPublicAddress(address: string): boolean {
	try {
		const parsed = ipaddr.parse(address);
		if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
			return parsed.toIPv4Address().range() === 'unicast';
		}

		return parsed.range() === 'unicast';
	} catch {
		return false;
	}
}

async function guard(url: URL): Promise<PollFailure | null> {
	if (url.protocol !== 'https:') return 'blocked_scheme';

	const addresses = await lookup(url.hostname, { all: true, verbatim: true });
	if (addresses.length === 0) return 'ssrf_rejected';
	if (!addresses.every((entry) => isPublicAddress(entry.address))) return 'ssrf_rejected';

	return null;
}

function headerTypeAllowed(header: string | null, allowed: readonly string[]): boolean {
	if (!header) return true;

	const base = (header.split(';')[0] ?? '').trim().toLowerCase();
	if (base === '' || base === 'application/octet-stream') return true;

	return allowed.includes(base);
}

function capturedAtFrom(headers: Headers): { at: Date; source: 'header' | 'fetch' } {
	const now = Date.now();
	const header = headers.get('last-modified');

	if (header) {
		const parsed = Date.parse(header);
		if (Number.isFinite(parsed) && parsed <= now + CLOCK_SKEW_MS) {
			return { at: new Date(parsed), source: 'header' };
		}
	}

	return { at: new Date(now), source: 'fetch' };
}

function failed(status: PollFailure, error: string, httpStatus?: number): FetchOutcome {
	return { kind: 'failed', status, error, httpStatus };
}

export async function safeFetch(input: {
	url: string;
	validators: Validators;
	policy: PollPolicy;
}): Promise<FetchOutcome> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), input.policy.timeoutMs);

	try {
		let current = new URL(input.url);

		for (let hop = 0; hop <= input.policy.maxRedirects; hop += 1) {
			const blocked = await guard(current);
			if (blocked) return failed(blocked, `${blocked}: ${current.hostname}`);

			const headers: Record<string, string> = {
				accept: 'image/jpeg,image/png,image/*;q=0.8',
				'user-agent': 'webcam-scrapper/0.1'
			};
			if (input.validators.etag) headers['if-none-match'] = input.validators.etag;
			if (input.validators.lastModified) {
				headers['if-modified-since'] = input.validators.lastModified;
			}

			const response = await fetch(current, {
				headers,
				redirect: 'manual',
				signal: controller.signal
			});

			if (REDIRECT_STATUS.has(response.status)) {
				const location = response.headers.get('location');
				if (!location) return failed('http_error', 'redirect without location', response.status);
				current = new URL(location, current);
				continue;
			}

			if (response.status === 304) return { kind: 'not_modified', httpStatus: 304 };

			if (!response.ok) {
				return failed('http_error', `upstream answered ${response.status}`, response.status);
			}

			if (
				!headerTypeAllowed(response.headers.get('content-type'), input.policy.allowedContentTypes)
			) {
				return failed(
					'bad_content_type',
					`content-type ${response.headers.get('content-type')}`,
					response.status
				);
			}

			const declared = Number(response.headers.get('content-length') ?? '0');
			if (declared > input.policy.maxBytes) {
				return failed('too_large', `${declared} bytes`, response.status);
			}

			if (!response.body) return failed('empty', 'no body', response.status);

			const hash = createHash('sha256');
			const chunks: Uint8Array[] = [];
			let total = 0;

			for await (const chunk of response.body) {
				const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
				total += bytes.byteLength;
				if (total > input.policy.maxBytes) {
					controller.abort();
					return failed('too_large', `${total} bytes and counting`, response.status);
				}

				hash.update(bytes);
				chunks.push(bytes);
			}

			if (total === 0) return failed('empty', 'zero bytes', response.status);

			const merged = Buffer.concat(chunks, total);
			const image = detectImage(merged);
			if (!image) {
				return failed('bad_content_type', 'bytes are not a known image', response.status);
			}

			const captured = capturedAtFrom(response.headers);

			return {
				kind: 'image',
				bytes: merged,
				sha256: hash.digest('hex'),
				contentType: image.contentType,
				ext: image.ext,
				capturedAt: captured.at,
				capturedAtSource: captured.source,
				etag: response.headers.get('etag') ?? undefined,
				lastModified: response.headers.get('last-modified') ?? undefined,
				httpStatus: response.status
			};
		}

		return failed('http_error', 'too many redirects');
	} catch (error) {
		if (controller.signal.aborted)
			return failed('timeout', `no answer in ${input.policy.timeoutMs} ms`);

		const reason = error instanceof Error ? error.message : String(error);
		return failed('http_error', reason);
	} finally {
		clearTimeout(timer);
	}
}
