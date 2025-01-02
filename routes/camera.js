import fs from 'fs'
import path from 'path'
import { Router } from 'express'

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
  res.render('camera/metadata', {paper: paper})
})

// Update some metadata field of this paper
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
  }
  if (req.body.abstract) {
    paper.abstract = req.body.abstract
  }
  paper.lastUpdated = new Date().getTime()
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
  fs.readdirSync(venueDir, {withFileTypes: true}).forEach((entry) => {
    if (entry.isDirectory()) {
      const curPaper = fs.readFileSync(
        path.join(venueDir, entry.name, 'metadata.json'), 'utf8')
      papers[entry.name] = JSON.parse(curPaper)
    }
  })
  res.render('camera/manage', {
    venue: req.params.venue,
    papers: papers,
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
  // Create venue dir if needed
  if (!fs.existsSync(path.join(router.venues_dir, req.body.venue))) {
    fs.mkdirSync(path.join(router.venues_dir, req.body.venue))
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
      title: req.body.title,
      original_title: req.body.title,
      venue: req.body.venue,
      emailed: 0,
      authors: req.body.authors.split(';').map((author) => author.trim()),
      corresponding_email: req.body.corresponding_email.split(';').map(
        (email) => email.trim()),
      lastUpdated: new Date().getTime(),
    }))
  } catch (e) {
    console.error(e)
    fs.rmSync(paperDir, {recursive: true, force: true})
    return res.status(500).send('Error writing to disk: ' + e.message)
  }
  return res.status(200).send('Added paper ' + paperHash)
})

// Public domain hashing function from:
// https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
