import { caltrans } from './caltrans.ts';
import { digitraffic } from './digitraffic.ts';
import { fotoWebcam } from './foto-webcam.ts';
import { tfl } from './tfl.ts';
import type { SourceAdapter, SourceId } from '../lib/types.ts';

export const SOURCES: readonly SourceAdapter[] = [digitraffic, caltrans, tfl, fotoWebcam];

export const SOURCE_IDS: readonly SourceId[] = SOURCES.map((source) => source.id);
