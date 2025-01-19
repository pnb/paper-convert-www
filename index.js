import cluster from 'cluster'
import { exit } from 'process'
import { execSync } from 'child_process'
import os from 'os'
import { fileURLToPath } from 'url'
import express from 'express'
import path from 'path'
import { renderFile } from 'ejs'
import bodyParser from 'body-parser'
import fileUpload from 'express-fileupload'
import connectSlashes from 'connect-slashes'

import { router as routesConvert } from './routes/convert.js'
import { router as routesPdfCheck } from './routes/pdf_check.js'
import { router as routesAdmin } from './routes/admin.js'
import { router as routesCamera } from './routes/camera.js'
import { DocConverter } from './converter.js'
import { PdfChecker } from './pdf_checker.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
let converter // Global reference to converter so it doesn't get garbage collected
let pdfChecker // Same here

function addFork (env = {}) {
  const worker = cluster.fork(env)
  worker.on('exit', () => {
    console.error('Cluster worker crashed, starting a new one: env =', env)
    addFork(env)
  })
}

if (cluster.isPrimary) {
  // Check that the server was started in the expected way (it matters for env variables)
  if (!process.env?.npm_command || process.env.npm_command !== 'start') {
    console.error('Must be started with `npm start`')
    exit(1)
  }
  // Check some environment things
  const nodeVersion = execSync('node --version').toString()
  if (!nodeVersion.startsWith('v18.') && !nodeVersion.startsWith('v19.')) {
    console.error('NodeJS version 18 or 19 is required')
    exit(1)
  }
  try {
    execSync('pdf2svg')
  } catch (err) {
    if (err.status === 127) {
      console.error('pdf2svg not found; are you using the paper_convert conda environment?')
      exit(1)
    }
  }
  if (process.env.npm_package_config_admin_page_password === 'change-me') {
    console.error('Admin page password not set in package.json')
    exit(1)
  }

  // Create a worker for all CPU cores but 1, to be used for document conversion
  const numWorkers = Math.max(1, os.cpus().length - 1)
  for (let i = 0; i < numWorkers; ++i) {
    addFork({ isServer: true })
  }
  addFork({ isConverter: true })
  addFork({ isPdfChecker: true })
} else if (process.env.isConverter) {
  console.log('Started converter')
  converter = new DocConverter() // eslint-disable-line no-unused-vars
} else if (process.env.isPdfChecker) {
  console.log('Started PDF checker')
  pdfChecker = new PdfChecker() // eslint-disable-line no-unused-vars
} else {
  const app = express()

  // Use EJS for template rendering
  app.set('views', path.join(__dirname, 'views'))
  app.set('view engine', 'html')
  app.engine('html', renderFile)

  // Parse the body of requests (will go into `req.body.xxx`)
  app.use(bodyParser.urlencoded({ extended: false }))
  // Parse file uploads
  app.use(fileUpload({
    limits: {
      fileSize: 50 * 1024 * 1024 // 50 MB
    },
    abortOnLimit: true,
    createParentPath: true
  }))

  // Serve static assets, making clear what is publicly accessible
  app.use('/', express.static(path.join(__dirname, 'public')))

  // Redirect /xx/ to /xx to standardize URLs and avoid some relative URL problems
  app.use(connectSlashes(false))

  // Additional routes
  routesConvert.docs_dir = path.join(__dirname, 'papers')
  app.use('/', routesConvert)
  routesPdfCheck.pdfsDir = path.join(__dirname, 'pdf_checks')
  app.use('/pdf-check', routesPdfCheck)
  routesAdmin.docs_dir = routesConvert.docs_dir
  app.use('/admin', routesAdmin)
  routesCamera.venues_dir = path.join(__dirname, 'venues')
  app.use('/camera', routesCamera)

  app.listen(process.env.npm_package_config_port)
  console.log('Listening on port', process.env.npm_package_config_port)
}
