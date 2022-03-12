import cluster from 'cluster';
import { exit } from 'process';
import { execSync } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';
import express from 'express';
import path from 'path';
import { renderFile } from 'ejs';
import body_parser from 'body-parser';
import file_upload from 'express-fileupload';
import connect_slashes from 'connect-slashes';

import { router as routes_convert } from './routes/convert.js';
import { DocConverter } from './converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let converter;  // Global reference to converter so it doesn't get garbage collected


function add_fork(env = {}) {
    let worker = cluster.fork(env);
    worker.on('exit', () => {
        console.error('Cluster worker crashed, starting a new one: env =', env);
        add_fork(env);
    });
}


if (cluster.isPrimary) {
    // Check that the server was started in the expected way (it matters for env variables)
    if (!process.env?.npm_command || process.env.npm_command != 'start') {
        console.error('Must be started with `npm start`');
        exit(1);
    }
    // Check some environment things
    const node_version = execSync('node --version').toString();
    if (!node_version.startsWith('v17.')) {
        console.error('NodeJS version 17 is required');
        exit(1);
    }
    try {
        execSync('pdf2svg');
    } catch (err) {
        if (err.status === 127) {
            console.error('pdf2svg not found; are you using the paper_convert conda environment?');
            exit(1);
        }
    }

    // Create a worker for all CPU cores but 1, to be used for document conversion
    const num_workers = Math.max(1, os.cpus().length - 1);
    for (let i = 0; i < num_workers; ++i) {
        add_fork({'is_server': true});
    }
    add_fork({'is_converter': true});
} else if (process.env.is_converter) {
    console.log('Started converter');
    converter = new DocConverter();
} else {
    const app = express();

    // Use EJS for template rendering
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'html');
    app.engine('html', renderFile);

    // Parse the body of requests (will go into `req.body.xxx`)
    app.use(body_parser.urlencoded({extended: false}));
    // Parse file uploads
    app.use(file_upload({
        limits: {
            fileSize: 50 * 1024 * 1024,  // 50 MB
        },
        abortOnLimit: true,
        createParentPath: true,
    }));

    // Serve static assets, making clear what is publicly accessible
    app.use('/', express.static(path.join(__dirname, 'public')));

    // Redirect /xx/ to /xx to standardize URLs and avoid some relative URL problems
    app.use(connect_slashes(false));

    // Additional routes
    routes_convert.docs_dir = path.join(__dirname, 'papers');
    app.use('/', routes_convert);

    app.listen(80);
    console.log('Listening on port 80');
}
