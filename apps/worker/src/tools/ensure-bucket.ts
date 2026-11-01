import { loadConfig } from '../config.js';
import { S3Storage } from '../storage.js';

const config = loadConfig();
const storage = new S3Storage(config.storage);

await storage.ensureBucket();

console.log(JSON.stringify({ message: 'bucket ready', bucket: config.storage.bucket }));
