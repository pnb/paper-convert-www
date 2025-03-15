// Converter worker that checks the queue for docs to convert and handles them
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { nanoid } from 'nanoid'
import { parse as csvParse } from 'csv-parse/sync'

const docsDir = path.join(process.cwd(), 'papers')

export function getWarnings (docId) {
  // Parse the CSV list of conversion warnings for a document
  const docDir = path.join(docsDir, docId)
  try {
    const csvContent = fs.readFileSync(
      path.join(docDir, 'conversion_warnings.csv'), 'utf8')
    return csvParse(csvContent, { columns: true })
  } catch (_) {
    return [] // No warnings!
  }
}

export class DocConverter {
  constructor () {
    this.scriptsDir = process.env.npm_package_config_conversion_scripts_dir
    if (!fs.existsSync(path.join(this.scriptsDir, 'config.json'))) {
      throw Error('config.json not found in `conversion_scripts_dir` in package.json')
    }

    // Load conversion scripts config to get python path
    let scriptsConfig = fs.readFileSync(
      path.join(this.scriptsDir, 'config.json'), 'utf8')
    scriptsConfig = JSON.parse(scriptsConfig)
    this.pythonPath = scriptsConfig.python_path
    if (!fs.existsSync(this.pythonPath)) {
      throw Error('Python does not exist at `python_path` in config.json')
    }

    // Start monitoring for documents to convert
    this.queueTimerId = setInterval(() => this.#checkQueue(), 1000)
  }

  #checkQueue () {
    fs.readdirSync(docsDir).forEach((fname) => {
      if (fname.endsWith('.todo')) {
        // Found something in the queue
        // Try to call dibs on it (may fail in a concurrency situation)
        const dibsFname = path.join(docsDir, nanoid()) + '.dibs'
        try {
          fs.renameSync(path.join(docsDir, fname), dibsFname)
          this.#convert(dibsFname, fname.substring(0, fname.length - 5))
        } catch {}
      }
    })
  }

  #convert (dibsFname, docId) {
    console.log('DocConverter: Started document', docId)
    const outDir = path.join(docsDir, docId)
    const docFname = path.join(outDir, docId)
    const timeoutMs = parseInt(process.env.npm_package_config_conversion_time_limit_ms)
    let cmd = this.pythonPath + ' ' + this.scriptsDir
    let isTex = 0
    if (fs.existsSync(docFname + '.docx')) {
      cmd = path.join(cmd, 'main_docx.py') + ' ' + docFname + '.docx ' + outDir
    } else {
      isTex = 1
      cmd = path.join(cmd, 'main_latex.py') + ' ' + docFname + '.zip ' + outDir
      // It is also necessary to run python with its own time limit or its child
      // processes will not respect any kill signal; we add 1 second to ensure
      // that the converter timeout triggers first and we get the error message
      cmd += ' --timeout-ms ' + (timeoutMs + 1000)
    }
    const metadata = JSON.parse(fs.readFileSync(docFname + '.json', 'utf8'))
    if (metadata.original_filename.includes('--mathml')) {
      cmd += ' --mathml' // Bit of a hack
    }
    const startTime = Date.now()
    let stdout = ''
    try {
      stdout = execSync(cmd, { encoding: 'utf8', timeout: timeoutMs }).toString()
    } catch (sysErr) {
      stdout = sysErr.stdout + '\n' + sysErr.stderr
      let newWarning = 'unexpected,,' + isTex + '\n'
      if (Date.now() - startTime >= timeoutMs) {
        newWarning = 'timeout,,' + isTex + '\n'
      }
      if (!getWarnings(docId).length) {
        newWarning = 'warning_name,extra_info,is_tex\n' + newWarning
      }
      fs.appendFileSync(
        path.join(outDir, 'conversion_warnings.csv'), newWarning, 'utf8')
    }
    fs.writeFileSync(path.join(outDir, 'converter-output.txt'), stdout, 'utf8')

    // When done, delete the dibs file
    fs.unlinkSync(dibsFname)
    console.log('DocConverter: Finished document', docId)
  }
}
