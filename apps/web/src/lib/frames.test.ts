import { describe, expect, it } from 'vitest';
import { captureTime, dayEnd, dayStart, defaultFrameWindow, isDay } from './frames.js';

describe('defaultFrameWindow', () => {
	it('covers yesterday and today so a fresh camera still has frames', () => {
		expect(defaultFrameWindow(new Date('2026-11-01T23:30:00.000Z'))).toEqual({
			from: '2026-10-31',
			to: '2026-11-01'
		});
	});

	it('crosses a month boundary', () => {
		expect(defaultFrameWindow(new Date('2026-03-01T08:00:00.000Z'))).toEqual({
			from: '2026-02-28',
			to: '2026-03-01'
		});
	});
});

describe('isDay', () => {
	it('accepts a padded day and nothing else', () => {
		expect(isDay('2026-11-01')).toBe(true);
		expect(isDay('2026-1-1')).toBe(false);
		expect(isDay('yesterday')).toBe(false);
	});
});

describe('day bounds', () => {
	it('turns a picked day into UTC instants', () => {
		expect(dayStart('2026-11-01')).toBe('2026-11-01T00:00:00.000Z');
		expect(dayEnd('2026-11-01')).toBe('2026-11-01T23:59:59.999Z');
	});
});

describe('captureTime', () => {
	it('prints UTC so the server and the browser agree', () => {
		expect(captureTime('2026-11-01T10:05:00.000Z')).toBe('01 Nov, 10:05 UTC');
	});
});
