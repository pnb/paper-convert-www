import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet(
  '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM', 10)
const pdfsDir = path.join(process.cwd(), 'pdf_checks')

export const router = Router()

router.get('/', (req, res) => {
  res.render('pdf_check/start_new_pdf')
})

router.post('/upload', async (req, res) => {
  // File should be in req.files.pdf from express-fileupload middleware
  if (!req.files?.pdf) {
    return res.status(400).send('Error: No files uploaded')
  } else if (!req.files.pdf.name.endsWith('.pdf')) {
    return res.status(400).send('Error: Only .pdf files are allowed')
  }
  const id = nanoid()
  const docFname = path.join(pdfsDir, id, id + '.pdf')
  await req.files.pdf.mv(docFname)
  // Record metadata, should we ever need it
  const metadataFname = path.join(pdfsDir, id, id) + '.json'
  fs.writeFileSync(metadataFname, JSON.stringify({
    original_filename: req.files.pdf.name,
    size_bytes: req.files.pdf.size,
    server_time_ms: Date.now(),
    ...(req.body.venue ? { venue: req.body.venue } : {}),
    ...(req.body.cameraId ? { cameraId: req.body.cameraId } : {})
  }))
  // Create a file noting that we need to process this upload
  fs.closeSync(fs.openSync(path.join(pdfsDir, id + '.todo'), 'w'))
  res.redirect(req.baseUrl + '/process/' + id)
})

router.get('/process/:docId', (req, res) => {
  const docDir = path.join(pdfsDir, req.params.docId)
  if (!fs.existsSync(docDir)) {
    return res.status(404).send('Paper not found')
  }
  const outPath = path.join(docDir, 'pdf_checker-output.txt')
  if (!fs.existsSync(outPath)) {
    return res.status(200).send('Paper checking in progress (refresh to update)')
  }
  res.render('pdf_check/pdf_result', {
    docId: req.params.docId,
    checkerOutput: fs.readFileSync(outPath, 'utf-8')
  })
})

// Download the PDF
router.get('/pdf/:docId.pdf', (req, res) => {
  const docDir = path.join(pdfsDir, req.params.docId)
  if (!fs.existsSync(docDir)) {
    return res.status(404).send('Paper not found')
  }
  const pdfPath = path.join(docDir, req.params.docId + '.pdf')
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).send('Paper not found')
  }
  res.sendFile(pdfPath)
})

// Get PDF checking warnings for a given PDF's ID, or false if the PDF is not
// checked yet/doesn't exist
export function getPDFWarnings (docId) {
  const docDir = path.join(pdfsDir, docId)
  const outPath = path.join(docDir, 'pdf_checker-output.txt')
  if (!fs.existsSync(outPath)) {
    return false
  }
  const lines = fs.readFileSync(outPath, 'utf-8').split('\n')
  return lines.filter((line) => line.trim().length && !line.startsWith('info: '))
}

// Get PDF title for a given PDF's ID, if it has been checked (else false)
export function getPDFTitle (docId) {
  const docDir = path.join(pdfsDir, docId)
  const outPath = path.join(docDir, 'pdf_checker-output.txt')
  if (!fs.existsSync(outPath)) {
    return false
  }
  const lines = fs.readFileSync(outPath, 'utf-8').split('\n')
  const titleLine = lines.find((line) => line.startsWith('info: title='))
  if (!titleLine) {
    return false
  }
  return titleLine.slice(titleLine.indexOf('=') + 1).trim()
}
