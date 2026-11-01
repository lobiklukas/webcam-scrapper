import { imageSize } from 'image-size';

const CONTENT_TYPES = new Map<string, string>([
	['jpg', 'image/jpeg'],
	['png', 'image/png'],
	['webp', 'image/webp']
]);

export interface DetectedImage {
	contentType: string;
	ext: string;
}

export function detectImage(bytes: Uint8Array): DetectedImage | null {
	let type: string | undefined;

	try {
		type = imageSize(bytes).type;
	} catch {
		return null;
	}

	if (!type) return null;

	const contentType = CONTENT_TYPES.get(type);
	if (!contentType) return null;

	return { contentType, ext: type };
}
