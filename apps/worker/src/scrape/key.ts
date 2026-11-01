export function frameKey(input: {
	camId: number;
	capturedAt: Date;
	sha256: string;
	ext: string;
}): string {
	const year = input.capturedAt.getUTCFullYear();
	const month = String(input.capturedAt.getUTCMonth() + 1).padStart(2, '0');
	const day = String(input.capturedAt.getUTCDate()).padStart(2, '0');

	return `frames/${input.camId}/${year}/${month}/${day}/${input.sha256}.${input.ext}`;
}
