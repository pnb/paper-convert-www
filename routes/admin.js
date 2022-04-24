import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { JSDOM } from 'jsdom';


export let router = Router();

router.docs_dir = false;

router.get('/submitted-papers', (req, res) => {
    if (!router.docs_dir) {
        throw Error('`docs_dir` is not set in the admin.js router');
    }
    const paper_info = {};
    fs.readdirSync(router.docs_dir, {withFileTypes: true}).forEach((entry) => {
        if (entry.isDirectory()) {
            let submitted_time = 'error';
            try {
                const dir_stats = fs.statSync(path.join(router.docs_dir, entry.name));
                submitted_time = Math.round(dir_stats.birthtimeMs);
            } catch (_) {}

            try {
                const html = fs.readFileSync(path.join(router.docs_dir, entry.name, 'index.html'));
                const doc = new JSDOM(html).window.document;
                const titles = doc.getElementsByClassName('Paper-Title');
                if (titles.length > 0) {
                    const paper_title = titles.item(0).textContent;
                    // Make key sortable by title, then submitted time
                    paper_info[paper_title + submitted_time + entry.name] = {
                        id: entry.name,
                        time: submitted_time,
                        title: paper_title,
                    }
                } else {
                    paper_info[submitted_time + entry.name] = {
                        id: entry.name,
                        time: submitted_time,
                        title: '*No title!',
                    }
                }
            } catch (err) {
                if (err.code == 'ENOENT') {
                    paper_info[submitted_time + entry.name] = {
                        id: entry.name,
                        time: submitted_time,
                        title: '**No index.html (conversion probably failed)',
                    }
                } else {
                    console.error('Unexpected error!', err);
                }
            }
        }
    });
    res.render('admin/submitted', {papers: paper_info});
});
