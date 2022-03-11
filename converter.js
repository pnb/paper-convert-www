// Converter worker that checks the queue for docs to convert and handles them
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { nanoid } from 'nanoid';
import { parse as csv_parse } from 'csv-parse/sync';


export function get_warnings(doc_id) {
    // Parse the CSV list of conversion warnings for a document
    const doc_dir = path.join(process.env.npm_package_config_conversion_monitor_dir, doc_id);
    const csv_content = fs.readFileSync(path.join(doc_dir, 'conversion_warnings.csv'), 'utf8');
    return csv_parse(csv_content, {columns: true});
}


export class DocConverter {
    constructor() {
        this.scripts_dir = process.env.npm_package_config_conversion_scripts_dir;
        this.monitor_dir = process.env.npm_package_config_conversion_monitor_dir;
        if (!fs.existsSync(path.join(this.scripts_dir, 'config.json'))) {
            throw Error('config.json not found in `conversion_scripts_dir` in package.json');
        } else if (!fs.existsSync(this.monitor_dir)) {
            throw Error('Directory does not exist: `conversion_monitor_dir` in package.json');
        }

        // Load conversion scripts config to get python path
        let scripts_config = fs.readFileSync(path.join(this.scripts_dir, 'config.json'), 'utf8');
        scripts_config = JSON.parse(scripts_config);
        this.python_path = scripts_config['python_path'];
        if (!fs.existsSync(this.python_path)) {
            throw Error('Python does not exist at `python_path` in config.json');
        }

        // Start monitoring for documents to convert
        this.queue_timer_id = setInterval(() => this._check_queue(), 1000);
    }

    _check_queue() {
        fs.readdirSync(this.monitor_dir).forEach((fname) => {
            if (fname.endsWith('.todo')) {
                // Found something in the queue
                // Try to call dibs on it (may fail in a concurrency situation)
                const dibs_fname = path.join(this.monitor_dir, nanoid()) + '.dibs';
                try {
                    fs.renameSync(path.join(this.monitor_dir, fname), dibs_fname);
                    this._convert(dibs_fname, fname.substring(0, fname.length - 5));
                } catch {}
            }
        });
    }

    _convert(dibs_fname, doc_id) {
        console.log('DocConverter: Started document', doc_id);
        const out_dir = path.join(this.monitor_dir, doc_id);
        let doc_fname = path.join(out_dir, doc_id);
        let cmd = this.python_path + ' ' + this.scripts_dir;
        if (fs.existsSync(doc_fname + '.docx')) {
            cmd = path.join(cmd, 'main_docx.py') + ' ' + doc_fname + '.docx ' + out_dir;
        } else {
            cmd = path.join(cmd, 'main_latex.py') + ' ' + doc_fname + '.zip ' + out_dir;
        }
        try {
            var stdout = execSync(cmd, {encoding: 'utf8'}).toString();
        } catch (sys_err) {
            var stdout = sys_err.stdout + '\n' + sys_err.stderr;
        }
        fs.writeFileSync(path.join(out_dir, 'converter-output.txt'), stdout, 'utf8');

        // When done, delete the dibs file
        fs.unlinkSync(dibs_fname);
        console.log('DocConverter: Finished document', doc_id);
    }
}
