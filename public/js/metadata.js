/* global alert */ // ESLint

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
  pdfElem.classList.add('hidden')
  pdfElem.parentElement.querySelector('.busy').classList.remove('hidden')
  const formData = new FormData()
  formData.append('pdf', pdfElem.files[0])
  const response = await fetch(window.location.pathname + '/update', {
    method: 'POST',
    body: formData
  })
  if (response.ok) {
    pdfElem.parentElement.querySelector('.success').classList.remove('hidden')
    pdfLink.href = window.location.pathname + '/pdf'
    pdfLink.innerText = window.location.pathname.split('/').pop() + '.pdf'
    setTimeout(() => {
      pdfElem.parentElement.querySelector('.success').classList.add('hidden')
      pdfElem.parentElement.querySelector('button').classList.remove('hidden')
    }, 3000)
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
  document.querySelector('#conversion-high-severity').classList.add('hidden')
  document.querySelector('#conversion-other-severity').classList.add('hidden')
  document.querySelector('#certify-conversion input').checked = false
  document.querySelector('#certify-conversion').classList.remove('hidden')
  sourceElem.parentElement.querySelector('.busy').classList.remove('hidden')
  const formData = new FormData()
  formData.append('doc_file', sourceElem.files[0])
  const response = await fetch('/upload', {
    method: 'POST',
    body: formData
  })
  sourceElem.parentElement.querySelector('.busy').classList.add('hidden')

  // Check status of conversion periodically, especially for severe warnings
  if (response.ok && response.redirected) {
    const convertedId = response.url.split('/').pop()
    document.querySelector('#conversion-result .busy').classList.remove('hidden')
    function checkConversion (docId) {
      return new Promise((resolve, reject) => {
        const warningsTimerId = setInterval(async () => {
          const warningsRes = await fetch('/process/warnings/' + docId)
          if (warningsRes.ok) {
            const warnings = await warningsRes.json()
            if (warnings.finished) {
              clearInterval(warningsTimerId)
              resolve(warnings.warnings)
            }
          } else {
            clearInterval(warningsTimerId)
            resolve('error')
          }
        }, 3000)
      })
    }
    const warnings = await checkConversion(convertedId)
    document.querySelector('#conversion-result .busy').classList.add('hidden')
    document.querySelector('#conversion-high-severity').classList.toggle('hidden',
      warnings !== 'error' && !warnings.some((w) => w.severity === 'high'))
    document.querySelector('#conversion-other-severity').classList.toggle('hidden',
      warnings === 'error' || !warnings.some((w) => w.severity !== 'high'))

    // Now update the paper's status on the server
    sourceElem.parentElement.querySelector('.busy').classList.remove('hidden')
    const updateResponse = await fetch(window.location.pathname + '/update', {
      method: 'POST',
      body: new URLSearchParams({
        source_original_filename: sourceElem.files[0].name,
        converted_id: convertedId,
        convert_high_severity: warnings.filter((w) => w.severity === 'high').length,
        convert_medium_severity: warnings.filter((w) => w.severity === 'medium').length,
        convert_low_severity: warnings.filter((w) => w.severity === 'low').length
      })
    })
    sourceElem.parentElement.querySelector('.busy').classList.add('hidden')
    if (updateResponse.ok) {
      sourceLink.classList.remove('hidden')
      sourceLink.href = response.url
      sourceLink.innerText = convertedId
      setTimeout(() => {
        sourceElem.parentElement.querySelector('button').classList.remove('hidden')
      }, 3000)
    } else {
      alert('Error updating after conversion: ' + await updateResponse.text())
      sourceElem.parentElement.querySelector('button').classList.remove('hidden')
    }
  } else {
    alert('Error uploading source file: ' + await response.text())
    sourceElem.parentElement.querySelector('button').classList.remove('hidden')
  }
}

const certifyElem = document.querySelector('#certify-conversion input')
certifyElem.onchange = async () => {
  certifyElem.disabled = true
  const response = await fetch(window.location.pathname + '/update', {
    method: 'POST',
    body: new URLSearchParams({
      conversion_certified: certifyElem.checked * 1
    })
  })
  if (response.ok) {
    const successElem = document.querySelector('#certify-conversion')
      .parentElement.querySelector('.success')
    successElem.classList.remove('hidden')
    setTimeout(() => {
      successElem.classList.add('hidden')
    }, 3000)
  } else {
    alert('Error updating certification: ' + response.statusText)
  }
  certifyElem.disabled = false
}

const titleElem = document.getElementsByName('title').item(0)
let currentTitle = titleElem.value.trim()
titleElem.oninput = function () {
  if (currentTitle === titleElem.value.trim()) {
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
  } else {
    alert('Error updating title: ' + response.statusText)
  }
  this.disabled = false
  titleElem.disabled = false
}

const abstractElem = document.getElementsByName('abstract').item(0)
let currentAbstract = abstractElem.value
abstractElem.oninput = function () {
  if (currentAbstract === abstractElem.value.trim()) {
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
