import { createDb } from '@webcam-scrapper/db';
import { loadConfig } from './config.js';
import { log } from './log.js';
import { connectBroker } from './rabbit.js';
import { ScrapeWorker } from './scrape/worker.js';
import { S3Storage } from './storage.js';

const config = loadConfig();
const once = process.argv.includes('--once');

const { db, close } = createDb(config.databaseUrl);
const storage = new S3Storage(config.storage);
const broker = await connectBroker(config.amqpUrl);

await storage.ping();

const worker = new ScrapeWorker({ db, storage, broker, config });

function shutdown(signal: string): void {
	log('info', 'shutdown', { signal });
	worker.stop();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

try {
	await worker.run({ once });
} catch (error) {
	console.error(error instanceof Error ? (error.stack ?? error.message) : error);
	process.exitCode = 1;
} finally {
	await broker.close();
	await close();
	if (once) process.exit(process.exitCode ?? 0);
}
