import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import { JSDOM } from 'jsdom'

const docsDir = path.join(process.cwd(), 'papers')

export const router = Router()

router.get('/password', (req, res) => {
  if (!req.query.to) {
    return res.status(400).send('Missing expected URL parameter "to".')
  }
  res.render('admin/password', { redirectTo: req.query.to })
})

router.get('/', (req, res) => {
  res.redirect('/admin/password?to=' + encodeURIComponent('/admin/'))
})

router.post('/', (req, res) => {
  if (req.body.pw !== process.env.npm_package_config_admin_page_password) {
    return res.status(401).send('Incorrect password')
  }
  // Get list of venues by checking for folders in /venues
  const venues = fs.readdirSync(path.join(process.cwd(), 'venues'),
    { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  res.render('admin/index', { venues })
})

router.get('/submitted-papers', (req, res) => {
  res.redirect('/admin/password?to=' + encodeURIComponent('/admin/submitted-papers'))
})

router.post('/submitted-papers', (req, res) => {
  if (req.body.pw !== process.env.npm_package_config_admin_page_password) {
    return res.status(401).send('Incorrect password')
  }
  const paperInfo = {}
  fs.readdirSync(docsDir, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory()) {
      const curPaper = readPaperData(entry.name)
      // Make key sortable by title, then submitted time
      paperInfo[curPaper.title + curPaper.time + curPaper.id] = curPaper
    }
  })
  res.render('admin/submitted', { papers: paperInfo })
})

function readPaperData (dir) {
  try { // Check cached result first
    const jstr = fs.readFileSync(path.join(docsDir, dir, 'info_cache.json'), 'utf8')
    return JSON.parse(jstr)
  } catch (_) {}

  const curPaper = {
    id: dir,
    time: 'error',
    source_ext: '.docx',
    title: '***Unexpected error'
  }

  if (fs.existsSync(path.join(docsDir, dir, dir + '.zip'))) {
    curPaper.source_ext = '.zip'
  }

  try {
    const dirStats = fs.statSync(path.join(docsDir, dir))
    curPaper.time = Math.round(dirStats.ctimeMs)
  } catch (_) {}

  if (!fs.existsSync(path.join(docsDir, dir, 'converter-output.txt'))) {
    curPaper.title = '***Conversion in progress'
    return curPaper // Skip caching info because result may be incomplete
  }

  try {
    const html = fs.readFileSync(path.join(docsDir, dir, 'index.html'))
    const doc = new JSDOM(html).window.document
    const titles = doc.getElementsByClassName('Paper-Title')
    if (titles.length > 0) {
      curPaper.title = titles.item(0).textContent.trim()
    } else {
      curPaper.title = '*No title!'
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      curPaper.title = '**No index.html (conversion probably failed)'
    }
  }

  try { // Cache for next time
    fs.writeFileSync(path.join(docsDir, dir, 'info_cache.json'),
      JSON.stringify(curPaper), 'utf8')
  } catch (err) {
    console.error('Unexpected error:', err)
  }

  return curPaper
}
