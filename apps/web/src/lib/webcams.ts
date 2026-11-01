/** How the provider ids from `location.source` are credited on a tile. */
const SOURCE_LABELS: Readonly<Record<string, string>> = {
	digitraffic: 'Digitraffic',
	caltrans: 'Caltrans',
	tfl: 'TfL',
	'foto-webcam': 'foto-webcam'
};

/** Provider name for a tile caption; a provider we have not labelled yet shows its id. */
export function sourceLabel(source: string): string {
	return SOURCE_LABELS[source] ?? source;
}

/** Cards per request; also the page size that tells the infinite query when to stop. */
export const WEBCAM_PAGE_SIZE = 24;

/**
 * Offset for the next page of `GET /api/webcams`, or `undefined` when there is none.
 *
 * The generated infinite-query helper turns a numeric `pageParam` into `?offset=`, and a page
 * shorter than the requested size means the catalogue is exhausted.
 */
export function nextWebcamOffset(lastPageLength: number, lastOffset: unknown): number | undefined {
	if (lastPageLength < WEBCAM_PAGE_SIZE) return undefined;
	return (typeof lastOffset === 'number' ? lastOffset : 0) + WEBCAM_PAGE_SIZE;
}
