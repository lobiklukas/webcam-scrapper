/**
 * Public providers update more often than we should poll them: Caltrans and TfL publish a new
 * frame every minute, which for thousands of cameras is a request rate no demo needs. Cameras are
 * therefore never scheduled faster than ten minutes, and a provider that advertises a cadence of
 * weeks (foto-webcam's static cameras answer with a year) is still checked once an hour.
 */
const MIN_POLL_INTERVAL_S = 600;
const MAX_POLL_INTERVAL_S = 3600;

export function pollInterval(seconds: number): number {
	if (!Number.isFinite(seconds) || seconds <= 0) return MIN_POLL_INTERVAL_S;

	return Math.min(Math.max(Math.round(seconds), MIN_POLL_INTERVAL_S), MAX_POLL_INTERVAL_S);
}
