export function log(level: 'info' | 'warn' | 'error', message: string, fields: object = {}): void {
	console.log(JSON.stringify({ level, at: new Date().toISOString(), message, ...fields }));
}
