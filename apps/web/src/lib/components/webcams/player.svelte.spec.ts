import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Player from './player.svelte';
import type { Frame } from '#lib/frames.js';

const frame = (minute: number): Frame => ({
	id: `frame-${minute}`,
	capturedAt: new Date(Date.UTC(2026, 10, 1, 10, minute)).toISOString(),
	contentType: 'image/jpeg',
	bytes: 1024,
	url: `/api/frames/frame-${minute}`
});

const frames = [frame(0), frame(10), frame(20)];

describe('player.svelte', () => {
	it('shows the oldest frame of the window and its capture time', async () => {
		render(Player, { frames, alt: 'Kantatie 51, Inkoo' });

		await expect.element(page.getByRole('img')).toHaveAttribute('src', '/api/frames/frame-0');
		await expect.element(page.getByText('01 Nov, 10:00 UTC', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('From 01 Nov, 10:00 UTC')).toBeInTheDocument();
		await expect.element(page.getByText('To 01 Nov, 10:20 UTC')).toBeInTheDocument();
	});

	it('plays through the frames and stops on the last one', async () => {
		render(Player, { frames, alt: 'Kantatie 51, Inkoo' });

		await page.getByRole('button', { name: 'Play' }).click();

		await expect.element(page.getByRole('img')).toHaveAttribute('src', '/api/frames/frame-20', {
			timeout: 3000
		});
		await expect.element(page.getByRole('button', { name: 'Play' })).toBeInTheDocument();
	});

	it('stops back at the first frame', async () => {
		render(Player, { frames, alt: 'Kantatie 51, Inkoo' });

		await page.getByRole('button', { name: 'Play' }).click();
		await expect
			.element(page.getByRole('img'))
			.toHaveAttribute('src', '/api/frames/frame-10', { timeout: 3000 });
		await page.getByRole('button', { name: 'Stop' }).click();

		await expect.element(page.getByRole('img')).toHaveAttribute('src', '/api/frames/frame-0');
	});

	it('scrubs to the frame the timeline points at', async () => {
		render(Player, { frames, alt: 'Kantatie 51, Inkoo' });

		await page.getByRole('slider', { name: 'Timeline' }).fill('2');

		await expect.element(page.getByRole('img')).toHaveAttribute('src', '/api/frames/frame-20');
		await expect.element(page.getByText('01 Nov, 10:20 UTC', { exact: true })).toBeInTheDocument();
	});

	it('says so when the window has no frames', async () => {
		render(Player, { frames: [], alt: 'Kantatie 51, Inkoo' });

		await expect.element(page.getByText('No frames in this window.')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Play' })).toBeDisabled();
	});
});
