const express = require('express');
const morgan = require('morgan');
const pug = require('pug');
const got = require('got');
const AdmZip = require('adm-zip');
const app = express();
const router = express.Router();
const config = require('./config.json');
require('colors');

const FA_RELEASES_PAGE = 'https://github.com/FortAwesome/Font-Awesome/releases';

const DATA_SET = [
	{
		path: 'css/all',
		extensions: ['css']
	},
	{
		path: 'webfonts/fa-regular-400',
		extensions: ['eot', 'svg', 'ttf', 'woff', 'woff2']
	},
	{
		path: 'webfonts/fa-solid-900',
		extensions: ['eot', 'svg', 'ttf', 'woff', 'woff2']
	},
	{
		path: 'webfonts/fa-brands-400',
		extensions: ['eot', 'svg', 'ttf', 'woff', 'woff2']
	}
];

// START APPLICATION
app.set('etag', false);
app.use(express.static(`${__dirname}/public`));

// Create router
app.use(morgan('dev'));
router.use(express.json());
router.use(express.urlencoded({
	extended: true
}));

// Views
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');

app.engine('pug', pug.__express);

app.get('/', async (request, response) => {
	const versions = await getFA5Versions();
	response.render('home', {
		versions
	});
});

app.get('/fapro', async (request, response) => {
	const query = request.query;
	const versions = await getFA5Versions();

	if (!query.v || !versions.includes(query.v)) {
		response.status(404);
		return response.send();
	}

	const version = query.v.replace('Release ', '');
	const zip = new AdmZip();
	for (const file of DATA_SET) {
		for (const extension of file.extensions) {
			const file_name = `${file.path}.${extension}`;
			const file_url = `https://pro.fontawesome.com/releases/v${version}/${file_name}`;
			try {
				const file_response = await got(file_url, {
					encoding: null,
					headers: {
						Origin: 'https://fontawesome.com'
					}
				});
				const data = file_response.body;

				zip.addFile(file_name, data);

				console.log(`Added file ${file_name} to zip`);
			} catch (error) {
				console.log(error);
			}
		}
	}

	response.write(zip.toBuffer(), 'binary');
	response.end(null, 'binary');
});

// 404 handler
router.use((request, response) => {
	response.status(404);
	response.send();
});

// non-404 error handler
router.use((error, request, response) => {
	const status = error.status || 500;
	response.status(status);
	response.json({
		app: 'api',
		status: status,
		error: error.message
	});
});

// Starts the server
app.listen(config.http.port, () => {
	console.log(('Started '.green + 'on port '.blue + new String(config.http.port).yellow).bold);
});

async function getFA5Versions() {

	// I decided to use RegEx on HTML rather than use the API to try and get around ratelimits
	const response = await got(FA_RELEASES_PAGE);
	const html = response.body;

	const spans = html.match(/<div class="f1 flex-auto min-width-0 text-normal">(.+?)<\/div>/gms);

	const versions = spans.map(span => {
		return span.match(/>(.*?)</)[1];
	});

	return versions;
}
