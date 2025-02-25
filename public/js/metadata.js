/* global alert */ // ESLint

// Reset inputs to default values in case user refreshes page without saving and gets
// the wrong impression about what the current values are
document.querySelectorAll('input,textarea').forEach((x) => x.value = x.defaultValue)

document.getElementById('metadata-update').onsubmit = (e) => {
  // Prevent submit (happens with any button in Firefox even with no form action)
  e.preventDefault()
  return false
}

const pdfElem = document.getElementsByName('pdf').item(0)
const pdfLink = pdfElem.parentElement.querySelector('.current-file a')
pdfElem.parentElement.querySelector('button').onclick = function () {
  pdfElem.classList.remove('hidden')
  this.classList.add('hidden')
}
pdfElem.onchange = async () => {
  if (!pdfElem.files.length) {
    return
  }
  // Upload PDF to PDF checker to start checking and get PDF check ID
  pdfElem.classList.add('hidden')
  pdfLink.classList.add('hidden')
  document.querySelector('#pdf-checks-failed')?.classList?.add('hidden')
  pdfElem.parentElement.querySelector('.busy').classList.remove('hidden')
  const formData = new FormData()
  formData.append('pdf', pdfElem.files[0])
  formData.append('venue', window.location.pathname.split('/').slice(-2)[0])
  formData.append('cameraId', window.location.pathname.split('/').pop())
  const response = await fetch('/pdf-check/upload', {
    method: 'POST',
    body: formData
  })
  // Now update the PDF's status on the server
  if (response.ok && response.redirected) {
    const updateResponse = await fetch(window.location.pathname + '/update', {
      method: 'POST',
      body: new URLSearchParams({
        pdf_original_filename: pdfElem.files[0].name,
        pdf_check_id: response.url.split('/').pop()
      })
    })
    if (updateResponse.ok) {
      document.getElementById('currently-checking').classList.remove('hidden')
    } else {
      alert('Error recording upload: ' + await updateResponse.text())
      pdfElem.parentElement.querySelector('button').classList.remove('hidden')
    }
  } else {
    alert('Error uploading PDF: ' + await response.text())
    pdfElem.parentElement.querySelector('button').classList.remove('hidden')
  }
  pdfElem.parentElement.querySelector('.busy').classList.add('hidden')
}

const sourceElem = document.getElementsByName('source').item(0)
const sourceLink = sourceElem.parentElement.querySelector('.current-file a')
sourceElem.parentElement.querySelector('button').onclick = function () {
  sourceElem.classList.remove('hidden')
  this.classList.add('hidden')
}
sourceElem.onchange = async () => {
  if (!sourceElem.files.length) {
    return
  }
  // Upload source to start conversion and get conversion doc ID from the converter
  sourceElem.classList.add('hidden')
  sourceLink.classList.add('hidden')
  document.querySelector('#conversion-high-severity')?.classList?.add('hidden')
  document.querySelector('#conversion-other-severity')?.classList?.add('hidden')
  sourceElem.parentElement.querySelector('.busy').classList.remove('hidden')
  const formData = new FormData()
  formData.append('doc_file', sourceElem.files[0])
  const response = await fetch('/upload', {
    method: 'POST',
    body: formData
  })
  // Now update the paper's status on the server
  if (response.ok && response.redirected) {
    const updateResponse = await fetch(window.location.pathname + '/update', {
      method: 'POST',
      body: new URLSearchParams({
        source_original_filename: sourceElem.files[0].name,
        converted_id: response.url.split('/').pop()
      })
    })
    if (updateResponse.ok) {
      document.getElementById('currently-converting').classList.remove('hidden')
    } else {
      alert('Error recording upload: ' + await updateResponse.text())
      sourceElem.parentElement.querySelector('button').classList.remove('hidden')
    }
  } else {
    alert('Error uploading source file: ' + await response.text())
    sourceElem.parentElement.querySelector('button').classList.remove('hidden')
  }
  sourceElem.parentElement.querySelector('.busy').classList.add('hidden')
}

const certifyElem = document.querySelector('#certify-conversion input') || {}
certifyElem.onchange = async function () {
  this.disabled = true
  const response = await fetch(window.location.pathname + '/update', {
    method: 'POST',
    body: new URLSearchParams({
      conversion_certified: this.checked * 1
    })
  })
  if (response.ok) {
    document.querySelector('#certify-conversion .success').classList.remove('hidden')
    setTimeout(() => {
      document.querySelector('#certify-conversion .success').classList.add('hidden')
    }, 3000)
  } else {
    alert('Error updating certification: ' + response.statusText)
  }
  this.disabled = false
}

const titleElem = document.getElementsByName('title').item(0)
let currentTitle = titleElem.value.trim()
titleElem.oninput = function () {
  if (!titleElem.value.trim() || currentTitle === titleElem.value.trim()) {
    this.parentElement.querySelector('button').classList.add('hidden')
  } else {
    this.parentElement.querySelector('button').classList.remove('hidden')
  }
}
titleElem.parentElement.querySelector('button').onclick = async function () {
  this.disabled = true
  titleElem.disabled = true
  // Current URL is like /camera/metadata/somevenue/1234567890
  const response = await fetch(window.location.pathname + '/update', {
    method: 'POST',
    body: new URLSearchParams({
      title: titleElem.value.trim()
    })
  })
  if (response.ok) {
    this.classList.add('hidden')
    currentTitle = titleElem.value.trim()
    this.parentElement.querySelector('.success').classList.remove('hidden')
    setTimeout(() => {
      this.parentElement.querySelector('.success').classList.add('hidden')
    }, 3000)
    checkTitleMismatch()
  } else {
    alert('Error updating title: ' + response.statusText)
  }
  this.disabled = false
  titleElem.disabled = false
}

const abstractElem = document.getElementsByName('abstract').item(0)
let currentAbstract = abstractElem.value
abstractElem.oninput = function () {
  if (!abstractElem.value.trim() || currentAbstract === abstractElem.value.trim()) {
    this.parentElement.querySelector('button').classList.add('hidden')
  } else {
    this.parentElement.querySelector('button').classList.remove('hidden')
  }
}
abstractElem.parentElement.querySelector('button').onclick = async function () {
  this.disabled = true
  abstractElem.disabled = true
  const response = await fetch(window.location.pathname + '/update', {
    method: 'POST',
    body: new URLSearchParams({
      abstract: abstractElem.value.trim()
    })
  })
  if (response.ok) {
    this.classList.add('hidden')
    currentAbstract = abstractElem.value.trim()
    this.parentElement.querySelector('.success').classList.remove('hidden')
    setTimeout(() => {
      this.parentElement.querySelector('.success').classList.add('hidden')
    }, 3000)
  } else {
    alert('Error updating abstract: ' + response.statusText)
  }
  this.disabled = false
  abstractElem.disabled = false
}

function checkTitleMismatch () {
  const mismatchElem = document.getElementById('title-mismatch')
  const pdfTitle = mismatchElem.querySelector('code:nth-of-type(1) strong').textContent
  const htmlTitle = mismatchElem.querySelector('code:nth-of-type(2) strong').textContent
  const metadataTitle = titleElem.value.trim().toLowerCase().replace(/[^a-z0-9/]/g, '')
  if ((pdfTitle.length && pdfTitle !== metadataTitle) ||
      (htmlTitle.length && htmlTitle !== metadataTitle)) {
    mismatchElem.classList.remove('hidden')
  } else {
    mismatchElem.classList.add('hidden')
  }
  mismatchElem.querySelector('code:nth-of-type(3) strong').textContent = metadataTitle
}
checkTitleMismatch()
