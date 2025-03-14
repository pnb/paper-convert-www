import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import archiver from 'archiver'
import { stringify as csvStringify } from 'csv-stringify'
import { customAlphabet } from 'nanoid'

import { getConversionLog, getFullWarningsInfo, getHTMLTitle } from './convert.js'
import { getPDFWarnings, getPDFTitle } from './pdf_check.js'

export const router = Router()
const venuesDir = path.join(process.cwd(), 'venues')
const pdfsDir = path.join(process.cwd(), 'pdf_checks')
const genEditKey = customAlphabet('1234567890qwertyuiopasdfghjklzxcvbnm', 30)

function hasPermission (req, res, permission, editKey) {
  if (permission === 'admin' &&
      req.body.pw !== process.env.npm_package_config_admin_page_password) {
    return false
  } else if (permission === 'author' && req.query.editKey !== editKey &&
      req.body.editKey !== editKey) {
    return false
  }
  return true
}

// Show the data for this paper from the venue folder for this paper
router.get('/metadata/:venue/:camera_id', (req, res) => {
  const venueDir = path.join(venuesDir, req.params.venue)
  if (!fs.existsSync(venueDir)) {
    return res.status(404).send('Venue not found')
  }
  const paperDir = path.join(venueDir, req.params.camera_id)
  if (!fs.existsSync(paperDir)) {
    return res.status(404).send('Paper not found')
  }
  const paper = JSON.parse(
    fs.readFileSync(path.join(paperDir, 'metadata.json'), 'utf8'))
  // Check if PDF checking is done and update PDF metadata if needed
  if (paper.pdf_check_id && !(paper.pdf_checks_failed >= 0)) {
    const warnings = getPDFWarnings(paper.pdf_check_id)
    if (warnings !== false) {
      paper.pdf_checks_failed = warnings.length
      const title = getPDFTitle(paper.pdf_check_id)
      if (title !== false) {
        paper.pdfTitle = title
        paper.titleMismatch = titleMismatch(paper)
      }
      fs.writeFileSync(path.join(paperDir, 'metadata.json'), JSON.stringify(paper))
    }
  }
  // Check if the HTML conversion is done and update conversion metadata if needed
  if (paper.converted_id && !(paper.conversion_low_severity >= 0) &&
      getConversionLog(paper.converted_id).length > 0) {
    const warnings = getFullWarningsInfo(paper.converted_id)
    paper.conversion_low_severity = warnings.filter(
      (w) => w.severity === 'low').length
    paper.conversion_medium_severity = warnings.filter(
      (w) => w.severity === 'medium').length
    paper.conversion_high_severity = warnings.filter(
      (w) => w.severity === 'high').length
    paper.htmlTitle = getHTMLTitle(paper.converted_id)
    paper.titleMismatch = titleMismatch(paper)
    fs.writeFileSync(path.join(paperDir, 'metadata.json'), JSON.stringify(paper))
  }
  res.render('camera/metadata', { paper })
})

// Update some aspect of this paper
router.post('/metadata/:venue/:camera_id/update', (req, res) => {
  const venueDir = path.join(venuesDir, req.params.venue)
  if (!fs.existsSync(venueDir)) {
    return res.status(404).send('Venue not found')
  }
  const paperDir = path.join(venueDir, req.params.camera_id)
  if (!fs.existsSync(paperDir)) {
    return res.status(404).send('Paper not found')
  }
  const paper = JSON.parse(
    fs.readFileSync(path.join(paperDir, 'metadata.json'), 'utf8'))
  let edited = false
  let response = ''
  if (hasPermission(req, res, 'author', paper.editKey)) {
    edited = true
    if (req.body.title) {
      paper.title = req.body.title
      paper.titleMismatch = titleMismatch(paper)
    } else if (req.body.abstract) {
      paper.abstract = req.body.abstract
    } else if (req.body.pdf_original_filename) {
      paper.pdf_original_filename = req.body.pdf_original_filename
      paper.pdf_check_id = req.body.pdf_check_id
      delete paper.pdf_checks_failed
    } else if (req.body.source_original_filename) {
      paper.source_original_filename = req.body.source_original_filename
      paper.converted_id = req.body.converted_id
      paper.conversion_certified = false // New submission resets this
      delete paper.conversion_low_severity
      delete paper.conversion_medium_severity
      delete paper.conversion_high_severity
    } else if (req.body.conversion_certified !== undefined) {
      paper.conversion_certified = parseInt(req.body.conversion_certified) === 1
    } else {
      edited = false
    }
    if (edited) {
      paper.last_updated = Date.now()
    }
  } else if (hasPermission(req, res, 'admin')) {
    edited = true
    if (req.body.pageLimit !== undefined) {
      paper.pageLimit = parseInt(req.body.pageLimit)
    } else if (req.body.track && hasPermission(req, res, 'admin')) {
      paper.track = req.body.track
    } else if (req.body.regenerateEditKey) {
      paper.editKey = genEditKey()
      response = paper.editKey
    } else {
      edited = false
    }
  } else {
    return res.status(401).send('No editing permission')
  }
  if (!edited) {
    return res.status(400).send('No data to update')
  }
  fs.writeFileSync(path.join(paperDir, 'metadata.json'), JSON.stringify(paper))
  return res.status(200).send(response || 'Updated paper')
})

// Check if the titles match across PDF/HTML/metadata, returning the type of mismatch as
// a string ("PDF" or "HTML") or false if there is no mismatch.
function titleMismatch (paper) {
  const m = paper.title.toLowerCase().replace(/[^a-z0-9/]/g, '')
  if (paper.pdfTitle && paper.pdfTitle.toLowerCase().replace(/[^a-z0-9/]/g, '') !== m) {
    return 'PDF'
  }
  if (paper.htmlTitle &&
      paper.htmlTitle.toLowerCase().replace(/[^a-z0-9/]/g, '') !== m) {
    return 'HTML'
  }
  return false
}

// Delete a paper
router.delete('/metadata/:venue/:camera_id', (req, res) => {
  if (!hasPermission(req, res, 'admin')) {
    return res.status(401).send('Incorrect password')
  }
  const venueDir = path.join(venuesDir, req.params.venue)
  if (!fs.existsSync(venueDir)) {
    return res.status(404).send('Venue not found')
  }
  const paperDir = path.join(venueDir, req.params.camera_id)
  if (!fs.existsSync(paperDir)) {
    return res.status(404).send('Paper not found')
  }
  fs.rmSync(paperDir, { recursive: true, force: true })
  return res.status(200).send('Deleted paper')
})

router.get('/manage/:venue', (req, res) => {
  res.redirect('/admin/password?to=' +
    encodeURIComponent('/camera/manage/' + req.params.venue))
})

router.post('/manage/:venue', (req, res) => {
  if (!hasPermission(req, res, 'admin')) {
    return res.status(401).send('Incorrect password')
  }
  const papers = {}
  const venueDir = path.join(venuesDir, req.params.venue)
  fs.readdirSync(venueDir, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory()) {
      const curPaper = fs.readFileSync(
        path.join(venueDir, entry.name, 'metadata.json'), 'utf8')
      papers[entry.name] = JSON.parse(curPaper)
    }
  })
  res.render('camera/manage', {
    venue: req.params.venue,
    papers,
    settings: JSON.parse(fs.readFileSync(path.join(venueDir, 'settings.json'), 'utf8'))
  })
})

router.get('/import', (req, res) => {
  res.redirect('/admin/password?to=' + encodeURIComponent('/camera/import'))
})

router.post('/import', (req, res) => {
  if (!hasPermission(req, res, 'admin')) {
    return res.status(401).send('Incorrect password')
  }
  res.render('camera/import')
})

// Try to add one paper
router.post('/import/add-one', (req, res) => {
  if (!hasPermission(req, res, 'admin')) {
    return res.status(401).send('Incorrect password')
  }
  // Validate the venue
  if (!/^[a-z0-9]+$/.test(req.body.venue)) {
    return res.status(400).send('Invalid venue name')
  }
  // Create venue dir if needed and copy in settings template
  if (!fs.existsSync(path.join(venuesDir, req.body.venue))) {
    fs.mkdirSync(path.join(venuesDir, req.body.venue))
    fs.copyFileSync(path.join(venuesDir, 'settings_template.json'),
      path.join(venuesDir, req.body.venue, 'settings.json'))
  }
  // Check though if there's a paper with the same number and name (i.e., hash)
  // Salt the hash with the admin password so that anybody who knows the paper info
  // can't deduce the hash
  const unpaddedHash = '' + cyrb53(req.body.title + req.body.paper_num + req.body.pw)
  const paperHash = ('0000000000000000' + unpaddedHash).slice(-16)
  const paperDir = path.join(venuesDir, req.body.venue, paperHash)
  if (fs.existsSync(paperDir)) {
    return res.status(409).send('Paper ' + paperHash + ' already exists')
  }
  // Otherwise create the dir for it and set up the metadata JSON file therein
  fs.mkdirSync(paperDir)
  try {
    fs.writeFileSync(path.join(paperDir, 'metadata.json'), JSON.stringify({
      id: paperHash,
      paper_num: req.body.paper_num,
      track: req.body.track,
      title: req.body.title,
      original_title: req.body.title,
      venue: req.body.venue,
      emailed: 0,
      authors: req.body.authors.split(';').map((author) => author.trim()),
      corresponding_email: req.body.corresponding_email.split(';').map(
        (email) => email.trim()),
      decision: req.body.decision || null, // Optional, may be blank
      last_updated: Date.now(),
      editKey: genEditKey()
    }))
  } catch (e) {
    console.error(e)
    fs.rmSync(paperDir, { recursive: true, force: true })
    return res.status(500).send('Error writing to disk: ' + e.message)
  }
  return res.status(200).send('Added paper ' + paperHash)
})

// Send one email to corresponding authors via Postmark
router.post('/manage/:venue/email', async (req, res) => {
  if (!hasPermission(req, res, 'admin')) {
    return res.status(401).send('Incorrect password')
  }
  const venueDir = path.join(venuesDir, req.params.venue)
  if (!fs.existsSync(venueDir)) {
    return res.status(404).send('Venue not found')
  }
  const paperDir = path.join(venueDir, req.body.camera_id)
  if (!fs.existsSync(paperDir)) {
    return res.status(404).send('Paper not found')
  }
  // Get corresponding authors to send email to
  const paper = JSON.parse(
    fs.readFileSync(path.join(paperDir, 'metadata.json'), 'utf8'))
  const email = {
    From: process.env.npm_package_config_from_email,
    To: paper.corresponding_email.join(','),
    Subject: req.body.subject,
    TextBody: req.body.body,
    MessageStream: 'outbound',
    Tag: 'IEDMS',
    ...(req.body.ccReplyTo && { ReplyTo: req.body.ccReplyTo }),
    ...(req.body.ccReplyTo && { Cc: req.body.ccReplyTo })
  }
  const result = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': process.env.npm_package_config_postmark_api_key
    },
    body: JSON.stringify(email)
  })
  console.debug(await result.text())
  if (result.ok) {
    paper.emailed = paper.emailed + 1
    fs.writeFileSync(path.join(paperDir, 'metadata.json'), JSON.stringify(paper))
    // Also save to emails.json in the paper dir
    const emails = []
    if (fs.existsSync(path.join(paperDir, 'emails.json'))) {
      emails.push(...JSON.parse(
        fs.readFileSync(path.join(paperDir, 'emails.json'), 'utf8')))
    }
    emails.push(email)
    fs.writeFileSync(path.join(paperDir, 'emails.json'), JSON.stringify(emails))
    return res.status(200).send('Sent email')
  }
  return res.status(500).send('Error sending email: ' + result.statusText)
})

// Add email template, e.g., after a batch has been sent
router.post('/manage/:venue/add-email-template', (req, res) => {
  if (!hasPermission(req, res, 'admin')) {
    return res.status(401).send('Incorrect password')
  }
  const venueDir = path.join(venuesDir, req.params.venue)
  if (!fs.existsSync(venueDir)) {
    return res.status(404).send('Venue not found')
  }
  const settings = JSON.parse(
    fs.readFileSync(path.join(venueDir, 'settings.json'), 'utf8'))
  settings.emailAuthors.push({
    subject: req.body.subject,
    ccReplyTo: req.body.ccReplyTo.split(','),
    body: req.body.body,
    serverUnix: Date.now()
  })
  fs.writeFileSync(path.join(venueDir, 'settings.json'), JSON.stringify(settings))
  return res.status(200).send('Added email template')
})

// Route for exporting the proceedings PDFs, or a subset of them
router.post('/manage/:venue/export-pdf', async (req, res) => {
  if (!hasPermission(req, res, 'admin')) {
    return res.status(401).send('Incorrect password')
  }
  const venueDir = path.join(venuesDir, req.params.venue)
  if (!fs.existsSync(venueDir)) {
    return res.status(404).send('Venue not found')
  }
  if (!req.body.cameraIDs) {
    return res.status(400).send('No camera IDs provided')
  }
  if (!req.body.pdfNaming ||
      (!req.body.pdfNaming.includes('{NUM}') &&
      !req.body.pdfNaming.includes('{ORDER}'))) {
    return res.status(400).send(
      'Invalid PDF naming pattern provided (must have at least one placeholder)')
  }
  res.setHeader('Content-Disposition', 'attachment; filename="pcwww-export-pdf.zip"')
  res.setHeader('Content-Type', 'application/zip')
  const archive = archiver('zip', { zlib: { level: 5 } })
  archive.on('warning', (err) => {
    console.error(err)
    res.status(500).send('Server error creating zip: ' + err.message)
  })
  archive.on('error', (err) => {
    console.error(err)
    res.status(500).send('Server error creating zip: ' + err.message)
  })
  archive.pipe(res)
  // Compiled metadata file with paper info
  const metaCsvRows = [['#', 'track name', 'title', 'authors', 'abstract']]
  // Get list of paper camera IDs from req.body and add them to zip, streaming
  const cameraIDs = req.body.cameraIDs.split(',')
  for (let i = 0; i < cameraIDs.length; ++i) {
    const paperDir = path.join(venueDir, cameraIDs[i])
    if (!fs.existsSync(paperDir)) {
      return res.status(404).send('Paper ' + cameraIDs[i] + ' not found')
    }
    // Load paper metadata.json to get PDF filename
    const paper = JSON.parse(
      fs.readFileSync(path.join(paperDir, 'metadata.json'), 'utf8'))
    if (!paper.pdf_check_id) {
      return res.status(404).send('Paper ' + cameraIDs[i] + ' has no PDF')
    }
    const pdfPath = path.join(pdfsDir, paper.pdf_check_id, paper.pdf_check_id) + '.pdf'
    const fname = req.body.pdfNaming.replace('{NUM}', paper.paper_num)
      .replace('{ORDER}', i + 1)
    archive.file(pdfPath, { name: fname + '.pdf' })
    // Add paper info to submission.csv data
    metaCsvRows.push([
      paper.paper_num,
      paper.track,
      paper.title,
      paper.authors.join(', '),
      paper.abstract
    ])
  }
  // Save submission.csv to zip
  archive.append(csvStringify(metaCsvRows), { name: 'export-metadata.csv' })
  await archive.finalize()
})

// Public domain hashing function from:
// https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
function cyrb53 (str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed; let h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
