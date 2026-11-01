import { expect, it } from 'vitest';
import { imageUrl, readMetadata } from './foto-webcam.ts';

it('reads the catalogue out of the index page', () => {
	const html = [
		'<script>',
		'var wcmain= new Object;',
		'var metadata= new Object({"cams":[{"id":"nebelhorn","name":"Nebelhorn {S\\u00fcd} \\"Gipfel\\"","latitude":47.42,"longitude":10.34,"captureInterval":1800,"offline":false,"hidden":false}]});',
		'</script>'
	].join('\n');

	expect(readMetadata(html)).toEqual([
		{
			id: 'nebelhorn',
			name: 'Nebelhorn {Süd} "Gipfel"',
			latitude: 47.42,
			longitude: 10.34,
			captureInterval: 1800,
			offline: false,
			hidden: false
		}
	]);
});

it('fails loudly when the page layout changes', () => {
	expect(() => readMetadata('<html></html>')).toThrow(/metadata block not found/);
	expect(() => readMetadata('var metadata= new Object({"cams":[]')).toThrow(/not terminated/);
});

it('upgrades the size foto-webcam hosts itself and keeps a partner url as advertised', () => {
	const cam = { imgurl: 'https://www.foto-webcam.eu/webcam/nebelhorn/current/400.jpg' };
	const partner = {
		imgurl: 'https://www.foto-webcam.eu/webcam/tmp/partner/regensburg/current/400.jpg'
	};
	const external = { imgurl: 'https://www.megacam.at/webcam/amlach/current/400.jpg' };

	expect(imageUrl(cam)).toBe('https://www.foto-webcam.eu/webcam/nebelhorn/current/1200.jpg');
	expect(imageUrl(partner)).toBe(partner.imgurl);
	expect(imageUrl(external)).toBe(external.imgurl);
});
