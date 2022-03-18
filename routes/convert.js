import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import { get_warnings } from '../converter.js';

const nanoid = customAlphabet('1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM', 10);


export let router = Router();
router.docs_dir = false;

// Load warning definitions from scripts config
const scripts_dir = process.env.npm_package_config_conversion_scripts_dir;
if (!scripts_dir) {
    console.error('Must be started with `npm start`');
}
const messages_txt = fs.readFileSync(path.join(scripts_dir, 'messages.json'), 'utf8');
const warning_defs = JSON.parse(messages_txt)['warnings'];


router.get('/', (req, res) => {
    if (!router.docs_dir) {
        throw Error('`docs_dir` is not set in the convert.js router');
    }
    res.render('convert/start_new');
});

router.post('/upload', (req, res) => {
    // File should be in req.files.doc_file from express-fileupload middleware
    if (!req.files?.doc_file) {
        return res.status(400).send('Error: No files uploaded');
    } else if (!req.files.doc_file.name.endsWith('.zip') &&
               !req.files.doc_file.name.endsWith('.docx')) {
        return res.status(400).send('Error: Only .docx (Word) and .zip (LaTeX) files are allowed');
    }
    let id = nanoid();
    let doc_fname = path.join(router.docs_dir, id, id);
    if (req.files.doc_file.name.endsWith('.docx')) {
        doc_fname += '.docx'
    } else {
        doc_fname += '.zip'
    }
    req.files.doc_file.mv(doc_fname).then(() => {
        // Record metadata, should we ever need it
        let metadata_fname = path.join(router.docs_dir, id, id) + '.json';
        fs.writeFileSync(metadata_fname, JSON.stringify({
            'original_filename': req.files.doc_file.name,
            'size_bytes': req.files.doc_file.size,
            'server_time_ms': Date.now(),
        }));
        // Create a file noting that we need to process this upload
        fs.closeSync(fs.openSync(path.join(router.docs_dir, id + '.todo'), 'w'));
        res.redirect(req.baseUrl + '/process/' + id);
    });
});

router.get('/view/edm2022.css', (req, res) => {
    res.redirect('/css/edm2022.css');
});

router.get('/view/:doc_id', (req, res) => {
    res.redirect(req.baseUrl + req.url + '/index.html');
});

router.get('/view/:doc_id/:filename*', (req, res) => {
    let fname = req.params.filename;
    if (req.params[0] && !req.params[0].includes('..') && !req.params[0].includes('//')) {
        fname += req.params[0];
    }
    res.sendFile(path.join(router.docs_dir, req.params.doc_id, fname));
});

router.get('/process/:doc_id', (req, res) => {
    // Check on the progress of the conversion
    let conversion_log = [];
    try {
        let log_fname = path.join(router.docs_dir, req.params.doc_id, 'converter-output.txt');
        conversion_log = fs.readFileSync(log_fname, {encoding: 'utf8'});
        conversion_log = conversion_log.split(/\n+/);
    } catch {}  // Not yet finished converting

    // Get full information about warnings from conversion's messages.json
    const warnings = [];
    if (conversion_log.length) {
        let log_lines = [];
        try {
            log_lines = get_warnings(req.params.doc_id);
        } catch {}  // No warnings!
        log_lines.forEach((warning) => {
            const def = structuredClone(warning_defs[warning.warning_name]);
            if (parseInt(warning.is_tex) && def.tex) {
                for (let key in def.tex) {
                    def[key] = def.tex[key];
                }
            }
            warnings.push({
                'message': def.message,
                'help': def.help,
                'extra_info': warning.extra_info,
            });
        });
    }

    res.render('convert/result', {
        'started': !fs.existsSync(path.join(router.docs_dir, req.params.doc_id + '.todo')),
        'conversion_log': conversion_log,
        'warnings': warnings,
        'doc_id': req.params.doc_id,
    });
});
