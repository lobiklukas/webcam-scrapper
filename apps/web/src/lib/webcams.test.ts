import { describe, expect, it } from 'vitest';
import { nextWebcamOffset, sourceLabel, WEBCAM_PAGE_SIZE } from './webcams.js';

describe('nextWebcamOffset', () => {
	it('stops at a short page and steps by one page otherwise', () => {
		expect(nextWebcamOffset(WEBCAM_PAGE_SIZE, 0)).toBe(WEBCAM_PAGE_SIZE);
		expect(nextWebcamOffset(WEBCAM_PAGE_SIZE - 1, 0)).toBeUndefined();
		expect(nextWebcamOffset(WEBCAM_PAGE_SIZE, undefined)).toBe(WEBCAM_PAGE_SIZE);
	});
});

describe('sourceLabel', () => {
	it('names the known providers and falls back to the raw id', () => {
		expect(sourceLabel('digitraffic')).toBe('Digitraffic');
		expect(sourceLabel('tfl')).toBe('TfL');
		expect(sourceLabel('panomax')).toBe('panomax');
	});
});
