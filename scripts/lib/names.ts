/**
 * Providers publish camera names for machines, not for people: `kt51_Inkoo`,
 * `SR-20 : At SR-1 - Looking East (C020)`, `Blackheath Rd/Greenwich High Rd`. These helpers turn
 * them into titles that can be dropped into a tile caption unchanged.
 */

const SEPARATORS = [
	[/_/g, ' '],
	[/\s*\/\s*/g, ' / '],
	[/\s*:\s*/g, ': '],
	[/\s*,\s*/g, ', '],
	[/(?<=[\p{L}\p{N}])\(/gu, ' ('],
	[/\s+/g, ' ']
] as const;

/** Collapses provider separators into prose: no underscores, even spacing, no stray ends. */
export function tidy(value: string): string {
	const collapsed = SEPARATORS.reduce((text, [pattern, replacement]) => {
		return text.replace(pattern, replacement);
	}, value);

	return collapsed.replace(/^[\s,/:-]+/, '').replace(/[\s,/:-]+$/, '');
}

/** `SCREAMING TOKENS` become sentence case; short codes and anything carrying digits stay put. */
export function unscream(value: string): string {
	return value.replace(/(?<![\p{L}])\p{Lu}{4,}(?![\p{L}])/gu, (word) => {
		return word.charAt(0) + word.slice(1).toLowerCase();
	});
}

export type Expander = (value: string) => string;

/** Word-boundary abbreviation lookup, compiled once per dictionary. */
export function expander(abbreviations: Readonly<Record<string, string>>): Expander {
	const keys = Object.keys(abbreviations)
		.toSorted((left, right) => right.length - left.length)
		.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const pattern = new RegExp(`(?<![\\p{L}])(${keys.join('|')})(?![\\p{L}])`, 'giu');

	return (value) => {
		return value.replace(pattern, (match) => abbreviations[match.toLowerCase()] ?? match);
	};
}

/**
 * `St` is a street at the end of a name and a saint at the start (`St Georges Sq/Lupus St`), so it
 * only expands when nothing follows it inside its slash-separated segment.
 */
export function streetSuffixes(value: string): string {
	return value.replace(/\bSt\b(?=\s*(?:[/(,]|$))/g, 'Street');
}

const FINNISH_ROADS: Readonly<Record<string, string>> = {
	kt: 'Kantatie',
	vt: 'Valtatie',
	st: 'Seututie',
	yt: 'Yhdystie',
	mt: 'Maantie',
	pt: 'Paikallistie'
};

const FINNISH_ROAD = /\b(kt|vt|st|yt|mt|pt)[\s]*(\d{1,3})(?=\s|$)/giu;

/** `kt51_Inkoo` reads `Kantatie 51, Inkoo`: Digitraffic prefixes every station with its road class. */
export function finnishRoad(value: string): string {
	return value.replace(FINNISH_ROAD, (match, code: string, number: string, offset: number) => {
		const label = FINNISH_ROADS[code.toLowerCase()];
		if (!label) return match;

		return `${label} ${number}${offset === 0 ? ',' : ''}`;
	});
}

/** The usual pipeline: separators, casing, then the provider's abbreviations. */
export function humanize(value: string, expand: Expander = (text) => text): string {
	return expand(unscream(tidy(value)));
}

/** `Hwy 5 at Pocket` in `Sacramento`: keeps the city only when the name does not carry it already. */
export function withPlace(name: string, place: string): string {
	if (!place || name.toLowerCase().includes(place.toLowerCase())) return name;

	return `${name}, ${place}`;
}
