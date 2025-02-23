// Worker that monitors PDFs to be checks and processes them
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { nanoid } from 'nanoid'

const venuesDir = path.join(process.cwd(), 'venues')
const pdfsDir = path.join(process.cwd(), 'pdf_checks')

export class PdfChecker {
  constructor () {
    this.scriptsDir = process.env.npm_package_config_conversion_scripts_dir
    if (!fs.existsSync(this.scriptsDir)) {
      throw Error('Directory does not exist: `scripts_dir` in package.json')
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
    fs.readdirSync(pdfsDir).forEach((fname) => {
      if (fname.endsWith('.todo')) {
        // Found something in the queue
        // Try to call dibs on it (may fail in a concurrency situation)
        const dibsFname = path.join(pdfsDir, nanoid()) + '.dibs'
        try {
          fs.renameSync(path.join(pdfsDir, fname), dibsFname)
          this.#checkPdf(dibsFname, fname.substring(0, fname.length - 5))
        } catch {}
      }
    })
  }

  #checkPdf (dibsFname, pdfId) {
    console.log('PdfChecker: Started document', pdfId)
    const outDir = path.join(pdfsDir, pdfId)
    // Load metadata from JSON
    let pageLimit = ''
    const pdfMetadata = JSON.parse(fs.readFileSync(
      path.join(outDir, pdfId) + '.json', 'utf8'))
    if (pdfMetadata.venue && pdfMetadata.cameraId) {
      const paperDir = path.join(venuesDir, pdfMetadata.venue, pdfMetadata.cameraId)
      const paperMetadata = JSON.parse(fs.readFileSync(
        path.join(paperDir, 'metadata.json'), 'utf8'))
      if (paperMetadata.pageLimit > 0) {
        pageLimit = ' --max-preref-pages ' + paperMetadata.pageLimit
      }
    }
    // Run checker
    let stdout = ''
    try {
      stdout = execSync(
        this.pythonPath + ' ' + path.join(this.scriptsDir, 'pdf_checker.py ') +
        path.resolve(path.join(outDir, pdfId) + '.pdf') + pageLimit,
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
