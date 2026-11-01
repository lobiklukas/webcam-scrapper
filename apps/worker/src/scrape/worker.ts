import type { Database } from '@webcam-scrapper/db';
import { FRAME_STORED, type Broker } from '../broker.js';
import type { WorkerConfig } from '../config.js';
import { log } from '../log.js';
import { sleep } from '../sleep.js';
import type { Storage } from '../storage.js';
import { claimDueCams, scrapeStats } from './claim.js';
import { classify } from './classify.js';
import { safeFetch } from './fetch.js';
import { groupByHost } from './hosts.js';
import { recordPoll } from './persist.js';
import type { ClaimedCam, PollPolicy } from './types.js';

const MAX_REDIRECTS = 2;
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const STATS_INTERVAL_MS = 30_000;

export interface ScrapeWorkerDeps {
	db: Database;
	storage: Storage;
	broker: Broker;
	config: WorkerConfig;
}

export class ScrapeWorker {
	private stopping = false;
	private readonly policy: PollPolicy;

	constructor(private readonly deps: ScrapeWorkerDeps) {
		this.policy = {
			maxBytes: deps.config.scrape.maxBytes,
			timeoutMs: deps.config.scrape.timeoutMs,
			maxRedirects: MAX_REDIRECTS,
			allowedContentTypes: ALLOWED_CONTENT_TYPES
		};
	}

	stop(): void {
		this.stopping = true;
	}

	async run({ once }: { once: boolean }): Promise<void> {
		if (!this.deps.config.scrape.enabled) {
			await this.report({ once });
			return;
		}

		await this.poll({ once });
	}

	private async report({ once }: { once: boolean }): Promise<void> {
		log('warn', 'scrape disabled, reporting due cameras');

		let lastDue = -1;
		let lastAt = 0;

		while (!this.stopping) {
			const stats = await scrapeStats(this.deps.db);
			const now = Date.now();

			if (stats.due !== lastDue || now - lastAt >= STATS_INTERVAL_MS) {
				log('info', 'due cameras', stats);
				lastDue = stats.due;
				lastAt = now;
			}

			if (once) return;
			await sleep(this.deps.config.scrape.idleMs);
		}
	}

	private async poll({ once }: { once: boolean }): Promise<void> {
		while (!this.stopping) {
			const claimed = await claimDueCams(this.deps.db, this.deps.config.scrape.batchSize);

			if (claimed.length === 0) {
				if (once) return;
				await sleep(this.deps.config.scrape.idleMs);
				continue;
			}

			log('info', 'claimed', { count: claimed.length });

			const groups = groupByHost(claimed);
			await Promise.all([...groups.values()].map((group) => this.pollGroup(group)));

			if (once) return;
		}
	}

	private async pollGroup(cams: ClaimedCam[]): Promise<void> {
		for (const cam of cams) {
			try {
				await this.pollCam(cam);
			} catch (error) {
				log('error', 'poll crashed', {
					camId: cam.id,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}
	}

	private async pollCam(cam: ClaimedCam): Promise<void> {
		const startedAt = new Date();
		const outcome = await safeFetch({
			url: cam.retrievalUrl,
			validators: { etag: cam.lastEtag ?? undefined, lastModified: cam.lastModified ?? undefined },
			policy: this.policy
		});
		const durationMs = Date.now() - startedAt.getTime();
		const record = classify(cam, outcome);

		if (record.kind === 'failed') {
			log('warn', 'poll failed', { camId: cam.id, status: record.status });
		}

		if (record.kind === 'stale') {
			log('warn', 'stale frame', { camId: cam.id, capturedAt: record.capturedAt.toISOString() });
		}

		const stored = await recordPoll(
			{ db: this.deps.db, storage: this.deps.storage },
			{ cam, record, startedAt, durationMs }
		);
		if (record.kind !== 'stored' || !stored) return;

		log('info', 'frame stored', { camId: cam.id, frameId: stored.frameId });

		try {
			await this.deps.broker.publish(FRAME_STORED, {
				frameId: stored.frameId,
				camId: cam.id,
				storageKey: stored.storageKey,
				sha256: record.image.sha256,
				bytes: record.image.bytes.byteLength,
				contentType: record.image.contentType,
				capturedAt: record.image.capturedAt.toISOString()
			});
		} catch (error) {
			log('error', 'publish failed', {
				camId: cam.id,
				frameId: stored.frameId,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
}
