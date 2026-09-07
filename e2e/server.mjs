import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = {
	'.html': 'text/html',
	'.ts': 'text/javascript',
	'.js': 'text/javascript',
};

const server = createServer(async (req, res) => {
	try {
		const url = new URL(req.url, 'http://localhost');
		const file = url.pathname === '/' ? '/e2e/harness.html' : url.pathname;
		const data = await readFile(join(root, file));
		res.writeHead(200, {'Content-Type': types[extname(file)] ?? 'text/plain'});
		res.end(data);
	} catch {
		res.writeHead(404);
		res.end('not found');
	}
});

server.listen(4321, '127.0.0.1', () => console.log('e2e server on 127.0.0.1:4321'));
