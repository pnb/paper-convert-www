import fs from 'fs'
import path from 'path'
import { Router } from 'express'

import { getConversionLog, getFullWarningsInfo } from './convert.js'

export const router = Router()
router.venues_dir = false

// Show the data for this paper from the venue folder for this paper
router.get('/metadata/:venue/:camera_id', (req, res) => {
  const venueDir = path.join(router.venues_dir, req.params.venue)
  if (!fs.existsSync(venueDir)) {
    return res.status(404).send('Venue not found')
  }
  const paperDir = path.join(venueDir, req.params.camera_id)
  if (!fs.existsSync(paperDir)) {
    return res.status(404).send('Paper not found')
  }
  const paper = JSON.parse(
    fs.readFileSync(path.join(paperDir, 'metadata.json'), 'utf8'))
  // Check if the conversion is done and update conversion metadata if needed
  if (paper.converted_id &&
      !Object.prototype.hasOwnProperty.call(paper, 'conversion_low_severity') &&
      getConversionLog(paper.converted_id).length > 0) {
    const warnings = getFullWarningsInfo(paper.converted_id)
    paper.conversion_low_severity = warnings.filter(
      (w) => w.severity === 'low').length
    paper.conversion_medium_severity = warnings.filter(
      (w) => w.severity === 'medium').length
    paper.conversion_high_severity = warnings.filter(
      (w) => w.severity === 'high').length
    fs.writeFileSync(path.join(paperDir, 'metadata.json'), JSON.stringify(paper))
  }
  res.render('camera/metadata', { paper })
})

// Download current version of PDF
router.get('/metadata/:venue/:camera_id/pdf', (req, res) => {
  const venueDir = path.join(router.venues_dir, req.params.venue)
  if (!fs.existsSync(venueDir)) {
    return res.status(404).send('Venue not found')
  }
  const paperDir = path.join(venueDir, req.params.camera_id)
  if (!fs.existsSync(paperDir)) {
    return res.status(404).send('Paper not found')
  }
  const pdfPath = path.join(paperDir, req.params.camera_id + '.pdf')
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).send('PDF not found')
  }
  res.download(pdfPath)
})

// Update some aspect of this paper
router.post('/metadata/:venue/:camera_id/update', (req, res) => {
  const venueDir = path.join(router.venues_dir, req.params.venue)
  if (!fs.existsSync(venueDir)) {
    return res.status(404).send('Venue not found')
  }
  const paperDir = path.join(venueDir, req.params.camera_id)
  if (!fs.existsSync(paperDir)) {
    return res.status(404).send('Paper not found')
  }
  const paper = JSON.parse(
    fs.readFileSync(path.join(paperDir, 'metadata.json'), 'utf8'))
  if (req.body.title) {
    paper.title = req.body.title
  } else if (req.body.abstract) {
    paper.abstract = req.body.abstract
  } else if (req?.files?.pdf) {
    if (!req.files.pdf.name.toLowerCase().endsWith('.pdf')) {
      return res.status(400).send('PDF filename must end in .pdf')
    }
    paper.pdf_original_filename = req.files.pdf.name
    fs.writeFileSync(path.join(paperDir, req.params.camera_id + '.pdf'),
      req.files.pdf.data)
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
    return res.status(400).send('No data to update')
  }
  paper.last_updated = Date.now()
  fs.writeFileSync(path.join(paperDir, 'metadata.json'), JSON.stringify(paper))
  return res.status(200).send('Updated paper')
})

router.get('/manage/:venue', (req, res) => {
  res.redirect('/admin/password?to=' +
    encodeURIComponent('/camera/manage/' + req.params.venue))
})

router.post('/manage/:venue', (req, res) => {
  if (req.body.pw !== process.env.npm_package_config_admin_page_password) {
    return res.status(401).send('Incorrect password')
  }
  const papers = {}
  const venueDir = path.join(router.venues_dir, req.params.venue)
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
  if (!router.venues_dir) {
    throw Error('`venues_dir` is not set in the camera.js router')
  }
  res.redirect('/admin/password?to=' + encodeURIComponent('/camera/import'))
})

router.post('/import', (req, res) => {
  if (req.body.pw !== process.env.npm_package_config_admin_page_password) {
    return res.status(401).send('Incorrect password')
  }
  res.render('camera/import')
})

// Try to add one paper
router.post('/import/add-one', (req, res) => {
  if (req.body.pw !== process.env.npm_package_config_admin_page_password) {
    return res.status(401).send('Incorrect password')
  }
  // Validate the venue
  if (!/^[a-z0-9]+$/.test(req.body.venue)) {
    return res.status(400).send('Invalid venue name')
  }
  // Create venue dir if needed and copy in settings template
  if (!fs.existsSync(path.join(router.venues_dir, req.body.venue))) {
    fs.mkdirSync(path.join(router.venues_dir, req.body.venue))
    fs.copyFileSync(path.join(router.venues_dir, 'settings_template.json'),
      path.join(router.venues_dir, req.body.venue, 'settings.json'))
  }
  // Check though if there's a paper with the same name (i.e., hash)
  // Salt the hash with the admin password so that anybody who knows the paper title
  // can't deduce the hash
  const paperHash = '' + cyrb53(req.body.title + req.body.pw)
  const paperDir = path.join(router.venues_dir, req.body.venue, paperHash)
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
      last_updated: Date.now()
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
  if (req.body.pw !== process.env.npm_package_config_admin_page_password) {
    return res.status(401).send('Incorrect password')
  }
  const venueDir = path.join(router.venues_dir, req.params.venue)
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
  const result = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': process.env.npm_package_config_postmark_api_key
    },
    body: JSON.stringify({
      From: process.env.npm_package_config_from_email,
      To: paper.corresponding_email.join(','),
      Subject: req.body.subject,
      TextBody: req.body.body,
      MessageStream: 'outbound',
      Tag: 'IEDMS'
    })
  })
  console.debug(await result.text())
  if (result.ok) {
    paper.emailed = paper.emailed + 1
    fs.writeFileSync(path.join(paperDir, 'metadata.json'), JSON.stringify(paper))
    return res.status(200).send('Sent email')
  }
  return res.status(500).send('Error sending email: ' + result.statusText)
})

// Add email template after a batch has been sent
router.post('/manage/:venue/add-email-template', (req, res) => {
  if (req.body.pw !== process.env.npm_package_config_admin_page_password) {
    return res.status(401).send('Incorrect password')
  }
  const venueDir = path.join(router.venues_dir, req.params.venue)
  if (!fs.existsSync(venueDir)) {
    return res.status(404).send('Venue not found')
  }
  const settings = JSON.parse(
    fs.readFileSync(path.join(venueDir, 'settings.json'), 'utf8'))
  settings.email_authors.push({
    subject: req.body.subject,
    body: req.body.body,
    serverUnix: Date.now()
  })
  fs.writeFileSync(path.join(venueDir, 'settings.json'), JSON.stringify(settings))
  return res.status(200).send('Added email template')
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
