import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { JSDOM } from 'jsdom';


export const router = Router();

router.docs_dir = false;

router.get('/password', (req, res) => {
    if (!req.query.to) {
        return res.status(503).send('Missing expected URL parameter "to".')
    }
    res.render('admin/password', {redirectTo: req.query.to})
})

router.get('/submitted-papers', (req, res) => {
    res.redirect('/admin/password?to=' + encodeURIComponent('/admin/submitted-papers'))
})

router.post('/submitted-papers', (req, res) => {
    if (!router.docs_dir) {
        throw Error('`docs_dir` is not set in the admin.js router');
    }
    if (req.body.pw !== process.env.npm_package_config_admin_page_password) {
        return res.status(503).send('Incorrect password')
    }
    const paper_info = {};
    fs.readdirSync(router.docs_dir, {withFileTypes: true}).forEach((entry) => {
        if (entry.isDirectory()) {
            const cur_paper = read_paper_data(entry.name);
            // Make key sortable by title, then submitted time
            paper_info[cur_paper.title + cur_paper.time + cur_paper.id] = cur_paper;
        }
    });
    res.render('admin/submitted', {papers: paper_info});
});


function read_paper_data(dir) {
    try {  // Check cached result first
        const jstr = fs.readFileSync(path.join(router.docs_dir, dir, 'info_cache.json'), 'utf8');
        return JSON.parse(jstr);
    } catch (_) {}

    const cur_paper = {
        id: dir,
        time: 'error',
        source_ext: '.docx',
        title: '***Unexpected error',
    };

    if (fs.existsSync(path.join(router.docs_dir, dir, dir + '.zip'))) {
        cur_paper.source_ext = '.zip';
    }

    try {
        const dir_stats = fs.statSync(path.join(router.docs_dir, dir));
        cur_paper.time = Math.round(dir_stats.birthtimeMs);
    } catch (_) {}

    if (!fs.existsSync(path.join(router.docs_dir, dir, 'converter-output.txt'))) {
        cur_paper.title = '***Conversion in progress';
        return cur_paper;  // Skip caching info because result may be incomplete
    }

    try {
        const html = fs.readFileSync(path.join(router.docs_dir, dir, 'index.html'));
        const doc = new JSDOM(html).window.document;
        const titles = doc.getElementsByClassName('Paper-Title');
        if (titles.length > 0) {
            cur_paper.title = titles.item(0).textContent.trim();
        } else {
            cur_paper.title = '*No title!';
        }
    } catch (err) {
        if (err.code == 'ENOENT') {
            cur_paper.title = '**No index.html (conversion probably failed)';
        }
    }

    try {  // Cache for next time
        fs.writeFileSync(path.join(router.docs_dir, dir, 'info_cache.json'),
            JSON.stringify(cur_paper), 'utf8');
    } catch (err) {
        console.error('Unexpected error:', err);
    }

    return cur_paper;
}
