import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import { customAlphabet } from 'nanoid'
import { get_warnings as getWarnings } from '../converter.js'

const nanoid = customAlphabet(
  '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM', 10)
const docsDir = path.join(process.cwd(), 'papers')

export const router = Router()

// Load warning definitions from scripts config
const scriptsDir = process.env.npm_package_config_conversion_scripts_dir
if (!scriptsDir) {
  console.error('Must be started with `npm start`')
}
const messagesTxt = fs.readFileSync(path.join(scriptsDir, 'messages.json'), 'utf8')
const warningDefs = JSON.parse(messagesTxt).warnings

router.get('/', (req, res) => {
  res.render('convert/start_new')
})

router.post('/upload', (req, res) => {
  // File should be in req.files.doc_file from express-fileupload middleware
  if (!req.files?.doc_file) {
    return res.status(400).send('Error: No files uploaded')
  } else if (!req.files.doc_file.name.endsWith('.zip') &&
             !req.files.doc_file.name.endsWith('.docx')) {
    return res.status(400).send(
      'Error: Only .docx (Word) and .zip (LaTeX) files are allowed')
  }
  const id = nanoid()
  let docFname = path.join(docsDir, id, id)
  if (req.files.doc_file.name.endsWith('.docx')) {
    docFname += '.docx'
  } else {
    docFname += '.zip'
  }
  req.files.doc_file.mv(docFname).then(() => {
    // Record metadata, should we ever need it
    const metadataFname = path.join(docsDir, id, id) + '.json'
    fs.writeFileSync(metadataFname, JSON.stringify({
      original_filename: req.files.doc_file.name,
      size_bytes: req.files.doc_file.size,
      server_time_ms: Date.now()
    }))
    // Create a file noting that we need to process this upload
    fs.closeSync(fs.openSync(path.join(docsDir, id + '.todo'), 'w'))
    res.redirect(req.baseUrl + '/process/' + id)
  })
})

router.get('/view/iedms.css', (req, res) => {
  res.redirect('/css/iedms.css')
})

router.get('/view/table_sizer.js', (req, res) => {
  res.redirect('/js/table_sizer.js')
})

router.get('/view/:doc_id', (req, res) => {
  res.redirect(req.baseUrl + req.url + '/index.html')
})

router.get('/view/:doc_id/:filename*', (req, res) => {
  let fname = req.params.filename
  if (req.params[0] && !req.params[0].includes('..') && !req.params[0].includes('//')) {
    fname += req.params[0]
  }
  res.sendFile(path.join(docsDir, req.params.doc_id, fname))
})

// Check on the progress of the conversion or view its warnings
router.get('/process/:doc_id', (req, res) => {
  res.render('convert/result', {
    started: !fs.existsSync(path.join(docsDir, req.params.doc_id + '.todo')),
    conversion_log: getConversionLog(req.params.doc_id),
    warnings: getFullWarningsInfo(req.params.doc_id),
    doc_id: req.params.doc_id
  })
})

export function getConversionLog(docId) {
  const logFname = path.join(docsDir, docId, 'converter-output.txt')
  let conversionLog = []
  try {
    conversionLog = fs.readFileSync(logFname, { encoding: 'utf8' })
    conversionLog = conversionLog.split(/\n+/)
  } catch (_) {} // Not yet finished converting
  return conversionLog
}

// Get full information about warnings from conversion's messages.json
export function getFullWarningsInfo(docId) {
  const warnings = []
  const logLines = getWarnings(docId)
  logLines.forEach((warning) => {
    const def = structuredClone(warningDefs[warning.warning_name])
    if (parseInt(warning.is_tex) && def?.tex) {
      for (const key in def.tex) {
        def[key] = def.tex[key]
      }
    }
    warnings.push({
      message: def.message,
      severity: def.severity,
      help: def.help,
      extra_info: warning.extra_info
    })
  })
  return warnings
}
