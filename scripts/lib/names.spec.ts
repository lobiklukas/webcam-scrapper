import { describe, expect, it } from 'vitest';
import {
	expander,
	finnishRoad,
	humanize,
	streetSuffixes,
	tidy,
	unscream,
	withPlace
} from './names.ts';
import { pollInterval } from './poll.ts';

const tfl = expander({ rd: 'Road', sq: 'Square' });

describe('tidy', () => {
	it('turns provider separators into prose', () => {
		expect(tidy('Hwy_50_at__Harbor_Blvd')).toBe('Hwy 50 at Harbor Blvd');
		expect(tidy('Blackheath Rd/Greenwich High Rd')).toBe('Blackheath Rd / Greenwich High Rd');
		expect(tidy('SR-20 : At SR-1')).toBe('SR-20: At SR-1');
		expect(tidy('Fulham Palace Road(Coroners Court)')).toBe('Fulham Palace Road (Coroners Court)');
		expect(tidy('__Inkoo,_')).toBe('Inkoo');
	});
});

describe('unscream', () => {
	it('sentences screaming words but keeps codes', () => {
		expect(unscream('ELEPHANT & CASTLE/WALWORTH ROAD')).toBe('Elephant & Castle/Walworth Road');
		expect(unscream('US-101 C020 PCH')).toBe('US-101 C020 PCH');
	});
});

describe('expander', () => {
	it('expands whole words only', () => {
		expect(tfl('Romford Rd / Tennyson Rd')).toBe('Romford Road / Tennyson Road');
		expect(tfl('Broadfields Avenue')).toBe('Broadfields Avenue');
		expect(tfl('Tulse Hill')).toBe('Tulse Hill');
	});
});

describe('streetSuffixes', () => {
	it('expands St at the end of a segment, not the saint at its start', () => {
		expect(streetSuffixes('St Georges Sq/Lupus St')).toBe('St Georges Sq/Lupus Street');
	});
});

describe('finnishRoad', () => {
	it('spells out the road class and separates the place', () => {
		expect(finnishRoad('kt51 Inkoo')).toBe('Kantatie 51, Inkoo');
		expect(finnishRoad(tidy('vt_21 Ylitornio Aavasaksa'))).toBe('Valtatie 21, Ylitornio Aavasaksa');
		expect(finnishRoad('Test vt20 Oulu')).toBe('Test Valtatie 20 Oulu');
		expect(finnishRoad('Tie 103 Vuosaari, Niinisaarentie')).toBe(
			'Tie 103 Vuosaari, Niinisaarentie'
		);
	});
});

describe('humanize', () => {
	it('applies separators, casing and the provider dictionary', () => {
		expect(humanize('Blackheath_Rd/GREENWICH High Rd', tfl)).toBe(
			'Blackheath Road / Greenwich High Road'
		);
	});
});

describe('withPlace', () => {
	it('adds the site only when the name does not carry it', () => {
		expect(withPlace('Hwy 5 at Pocket', 'Sacramento')).toBe('Hwy 5 at Pocket, Sacramento');
		expect(withPlace('Hwy 49 at Nevada City', 'Nevada City')).toBe('Hwy 49 at Nevada City');
	});
});

describe('pollInterval', () => {
	it('clamps the advertised cadence into what a public provider can afford', () => {
		expect(pollInterval(60)).toBe(600);
		expect(pollInterval(15 * 60)).toBe(900);
		expect(pollInterval(31_536_000)).toBe(3600);
		expect(pollInterval(Number.NaN)).toBe(600);
	});
});
