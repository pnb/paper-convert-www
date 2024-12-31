import fs from 'fs'
import path from 'path'
import { Router } from 'express'

export const router = Router()
router.venues_dir = false

router.get('/metadata/:camera_id', (req, res) => {
  // TODO: get the data for this paper from the already-generated folder (TODO) for this
  // ID, and 404 if the folder doesn't exist
  res.render('camera/metadata', {
    camera_id: req.params.camera_id
  })
})

// TODO: Maybe admin login required to show a page where something can be imported to
// create the dirs.
//    -- maybe that should then show up in ID as well
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
  const paperHash = '' + cyrb53(req.body.title)
  const paperDir = path.join(router.venues_dir, req.body.venue, paperHash)
  if (fs.existsSync(paperDir)) {
    return res.status(409).send('Paper ' + paperHash + ' already exists')
  }
  // Otherwise create the dir for it and set up the metadata JSON file therein
  fs.mkdirSync(paperDir)
  fs.writeFileSync(path.join(paperDir, 'metadata.json'), JSON.stringify({
    title: req.body.title,
    venue: req.body.venue,
    correspondingEmails: req.body.email.split(';').map((email) => email.trim()),
  }))
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
