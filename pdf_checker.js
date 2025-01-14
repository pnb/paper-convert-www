// Worker that monitors PDFs to be checks and processes them
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { nanoid } from 'nanoid'

export class PdfChecker {
  constructor () {
    this.scriptsDir = process.env.npm_package_config_conversion_scripts_dir
    this.monitorDir = process.env.npm_package_config_pdf_check_monitor_dir
    if (!fs.existsSync(this.scriptsDir)) {
      throw Error('Directory does not exist: `scripts_dir` in package.json')
    }
    if (!fs.existsSync(this.monitorDir)) {
      throw Error('Directory does not exist: `pdf_check_monitor_dir` in package.json')
    }
    // Load conversion scripts config to get python path
    let scriptsConfig = fs.readFileSync(
      path.join(this.scriptsDir, 'config.json'), 'utf8')
    scriptsConfig = JSON.parse(scriptsConfig)
    this.pythonPath = scriptsConfig.python_path
    if (!fs.existsSync(this.pythonPath)) {
      throw Error('Python does not exist at `python_path` in config.json')
    }
    // Start monitoring for PDFs to check
    this.queueTimerId = setInterval(() => this.#checkQueue(), 1000)
  }

  #checkQueue () {
    fs.readdirSync(this.monitorDir).forEach((fname) => {
      if (fname.endsWith('.todo')) {
        // Found something in the queue
        // Try to call dibs on it (may fail in a concurrency situation)
        const dibsFname = path.join(this.monitorDir, nanoid()) + '.dibs'
        try {
          fs.renameSync(path.join(this.monitorDir, fname), dibsFname)
          this.#checkPdf(dibsFname, fname.substring(0, fname.length - 5))
        } catch {}
      }
    })
  }

  #checkPdf (dibsFname, pdfId) {
    console.log('PdfChecker: Started document', pdfId)
    const outDir = path.join(this.monitorDir, pdfId)
    let stdout = ''
    try {
      stdout = execSync(
        this.pythonPath + ' ' + path.join(this.scriptsDir, 'pdf_checker.py ') +
        path.resolve(path.join(outDir, pdfId) + '.pdf'),
        { encoding: 'utf8' }).toString()
      console.log('PdfChecker: Finished document', pdfId)
    } catch (sysErr) {
      stdout = sysErr.stdout + '\n' + sysErr.stderr
      console.error('PdfChecker: Error checking PDF', pdfId, sysErr)
    }
    fs.writeFileSync(path.join(outDir, 'pdf_checker-output.txt'), stdout, 'utf8')
    fs.unlinkSync(dibsFname)
  }
}
