/**
 * Svelte action for infinite scrolling: calls `onReachEnd` whenever the element it is attached to
 * scrolls into view. Attach it to a sentinel `<div>` placed after the last rendered item.
 *
 * ```svelte
 * <div use:infiniteScroll={{ onReachEnd: () => $query.fetchNextPage(), disabled: !$query.hasNextPage }} />
 * ```
 *
 * `rootMargin` triggers the callback slightly before the sentinel is actually visible, so the next
 * page is usually already there when the user reaches the end.
 */
export interface InfiniteScrollOptions {
	/** Called once per intersection while `disabled` is false. */
	onReachEnd: () => void;
	/** Set while a page is loading, or when there is nothing left to load. */
	disabled?: boolean;
	/** How close the sentinel has to get to the viewport before loading starts. */
	rootMargin?: string;
}

export function infiniteScroll(node: HTMLElement, options: InfiniteScrollOptions) {
	let current = options;

	const observer = new IntersectionObserver(
		(entries) => {
			if (current.disabled) return;
			if (entries.some((entry) => entry.isIntersecting)) current.onReachEnd();
		},
		// The margin is read once; recreating the observer on every option change would be wasteful.
		{ rootMargin: options.rootMargin ?? '600px' }
	);

	observer.observe(node);

	return {
		update(next: InfiniteScrollOptions) {
			current = next;
		},
		destroy() {
			observer.disconnect();
		}
	};
}
