import { Router } from 'express'

export const router = Router()

router.get('/metadata/:camera_id', (req, res) => {
  // TODO: get the data for this paper from the already-generated folder (TODO) for this
  // ID, and 404 if the folder doesn't exist
  res.render('camera/metadata', {
    camera_id: req.params.camera_id
  })
})

// TODO: Maybe admin login required to show a page where something can be imported to
// create the dirs.
//  -- should allow a subdir probably for conference org, like edm2024
//    -- maybe that should then show up in ID as well
router.get('/import', (req, res) => {
    res.redirect('/admin/password?to=' + encodeURIComponent('/camera/import'))
})

router.post('/import', (req, res) => {
    if (req.body.pw !== process.env.npm_package_config_admin_page_password) {
        return res.status(503).send('Incorrect password')
    }
    res.render('camera/import')
})
