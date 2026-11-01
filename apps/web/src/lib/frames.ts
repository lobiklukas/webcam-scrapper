import type { FramesControllerListResponse } from '@webcam-scrapper/api-client';

/** Frames per player request; the API caps at the same number and keeps the newest of a window. */
export const FRAME_LIMIT = 200;

/** One frame per tick, whatever cadence the provider publishes at. */
export const FRAME_INTERVAL_MS = 400;

/** The days the timeline covers, as `<input type="date">` values (`YYYY-MM-DD`). */
export interface FrameWindow {
	from: string;
	to: string;
}

/** A frame as the player receives it; the API's list item, not the bytes. */
export type Frame = FramesControllerListResponse[number];

const DAY_MS = 86_400_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Whether a query parameter is a `YYYY-MM-DD` day the window can be built from. */
export const isDay = (value: string): boolean => DAY.test(value);

const toDay = (value: Date): string => value.toISOString().slice(0, 10);

/** What a player opens on: yesterday and today, so a fresh camera still has its newest frames. */
export function defaultFrameWindow(now: Date = new Date()): FrameWindow {
	return { from: toDay(new Date(now.getTime() - DAY_MS)), to: toDay(now) };
}

/** A picked day as the instant the API filters on, UTC like the capture times the worker stores. */
export const dayStart = (day: string): string => `${day}T00:00:00.000Z`;
export const dayEnd = (day: string): string => `${day}T23:59:59.999Z`;

const STAMP = new Intl.DateTimeFormat('en-GB', {
	day: '2-digit',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
	timeZone: 'UTC'
});

/** Capture time under the timeline, in UTC so the server and the browser print the same string. */
export const captureTime = (iso: string): string => `${STAMP.format(new Date(iso))} UTC`;
