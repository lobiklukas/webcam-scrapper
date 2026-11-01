const USER_AGENT = 'webcam-scrapper-seed/0.0.0';
const TIMEOUT_MS = 60_000;

async function request(url: string, headers: Readonly<Record<string, string>>): Promise<Response> {
	const response = await fetch(url, {
		headers: {
			// Digitraffic answers 406 without it, and it is the polite default for the others.
			'accept-encoding': 'gzip',
			'user-agent': USER_AGENT,
			...headers
		},
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});

	if (!response.ok) {
		throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
	}

	return response;
}

export async function fetchJson<T>(
	url: string,
	headers: Readonly<Record<string, string>> = {}
): Promise<T> {
	return (await (await request(url, headers)).json()) as T;
}

export async function fetchText(
	url: string,
	headers: Readonly<Record<string, string>> = {}
): Promise<string> {
	return (await request(url, headers)).text();
}
