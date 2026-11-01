/** Providers the seed knows how to read; also the value stored in `location.source`/`cam.source`. */
export type SourceId = 'digitraffic' | 'caltrans' | 'tfl' | 'foto-webcam';

/** A camera site, before it has a database id. */
export interface SeedLocation {
	source: SourceId;
	originalId: string;
	name: string;
	long: number;
	lat: number;
}

/** One camera view, pointing at its site through the provider's own location id. */
export interface SeedCam {
	source: SourceId;
	originalId: string;
	locationOriginalId: string;
	retrievalUrl: string;
	inCollection: boolean;
	pollIntervalS: number;
}

export interface Catalogue {
	locations: SeedLocation[];
	cams: SeedCam[];
}

/** One public camera source: a listing to read, mapped onto locations and cams. */
export interface SourceAdapter {
	id: SourceId;
	label: string;
	load(): Promise<Catalogue>;
}
