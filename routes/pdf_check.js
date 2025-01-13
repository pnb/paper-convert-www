import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet(
  '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM', 10)

export const router = Router()
router.pdfsDir = false

router.get('/', (req, res) => {
  if (!router.pdfsDir) {
    throw Error('`pdfsDir` is not set in the pdf_checks.js router')
  }
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
  const docFname = path.join(router.pdfsDir, id, id + '.pdf')
  await req.files.pdf.mv(docFname)
  // Record metadata, should we ever need it
  const metadataFname = path.join(router.pdfsDir, id, id) + '.json'
  fs.writeFileSync(metadataFname, JSON.stringify({
    original_filename: req.files.pdf.name,
    size_bytes: req.files.pdf.size,
    server_time_ms: Date.now()
  }))
  // Create a file noting that we need to process this upload
  fs.closeSync(fs.openSync(path.join(router.pdfsDir, id + '.todo'), 'w'))
  res.redirect(req.baseUrl + '/process/' + id)
})

router.get('/process/:docId', (req, res) => {
  const docDir = path.join(router.pdfsDir, req.params.docId)
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
