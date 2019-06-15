const url = require('url');
const path = require('path');
const fs = require("fs");
const got = require('got');
const Spinnies = require('spinnies');
const AdmZip = require('adm-zip');
const async = require('async');

const spinnies = new Spinnies();

const GOT_OPTIONS = {
	headers: {
		Origin: 'https://fontawesome.com',
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36'
	}
};

const FA_RELEASES_PAGE = 'https://github.com/FortAwesome/Font-Awesome/releases';
const FA_PRO_ASSET_BASE = 'https://kit-pro.fontawesome.com';

const fontUrlRegex = /url\((.*?)\)/gm;
const githubSpansRegex = /<div class="f1 flex-auto min-width-0 text-normal">(.+?)<\/div>/gms;
const githubReleasesRegex =/>(.*?)</;

main();

async function main() {
	spinnies.add('loading-versions', { text: 'Loading Font Awesome 5 versions' });
	const versions = await getFA5Versions();
	if (!versions || !versions[0]) {
		spinnies.fail('loading-versions', { text: 'Failed to load Font Awesome 5 versions' });
		return;
	}

	spinnies.succeed('loading-versions', { text: 'Loaded Font Awesome 5 versions' });

	const latestVersion = versions[0];
	
	spinnies.add('ripping-start', { text: `Ripping FA5 v${latestVersion}` });

	const zip = new AdmZip();
	const css = await got.get(`${FA_PRO_ASSET_BASE}/releases/v${latestVersion}/css/pro.min.css`, GOT_OPTIONS);
	GOT_OPTIONS.headers.Referer = `${FA_PRO_ASSET_BASE}/releases/v${latestVersion}/css/pro.min.css`;
	GOT_OPTIONS.encoding = null;

	const fontUrls = css.body
		.match(fontUrlRegex).map(url => url.replace('url(', '').replace(')', '').replace('../../..', FA_PRO_ASSET_BASE));;

	const cssFile = css.body
		.replace(/https:\/\/kit-free.fontawesome.com\/algo\/1/g, '..')
		.replace(/..\/..\/..\/algo\/1/g, '..')
		.replace(/webfonts/g, 'fonts');

	zip.addFile('css/all.css', Buffer.from(cssFile));

	async.each(fontUrls, (fontUrl, callback) => {
		
		const fileName = path.basename(url.parse(fontUrl).pathname);

		got(fontUrl, GOT_OPTIONS)
			.then(response => {
				zip.addFile(`fonts/${fileName}`, response.body);

				callback();
			})
			.catch(() => {
				callback();
			});
	}, () => {
		fs.writeFileSync(`${__dirname}/fa5-v${latestVersion}.zip`, zip.toBuffer());
		spinnies.succeed('ripping-start', { text: `Ripped FA5 v${latestVersion}. Saved to ${__dirname}/fa5-v${latestVersion}.zip` });
	});
}

async function getFA5Versions() {
	// I decided to use RegEx on HTML rather than use the API to try and get around ratelimits
	// This will break if GH changes the html layout
	const response = await got(FA_RELEASES_PAGE);
	const html = response.body;

	const spans = html.match(githubSpansRegex);

	const versions = spans.map(span => {
		return span.match(githubReleasesRegex)[1].replace('Release', '').trim();
	});

	return versions;
}
