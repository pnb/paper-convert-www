/* globals alert */ // ESLint

function makeTableSortable (table) {
  table.querySelectorAll('th.sortable').forEach((th) => {
    const colIndex = Array.from(table.querySelectorAll('th')).findIndex((x) => x === th)
    th.onclick = () => {
      const rows = Array.from(table.querySelectorAll('tbody tr'))
      rows.sort((a, b) => {
        const aval = a.querySelectorAll('td')[colIndex].textContent.trim()
        const bval = b.querySelectorAll('td')[colIndex].textContent.trim()
        if (!isNaN(aval) && !isNaN(bval)) {
          return parseFloat(aval) - parseFloat(bval) // Numeric compare if possible
        }
        return aval.localeCompare(bval)
      })
      rows.forEach((tr) => table.querySelector('tbody').appendChild(tr))
    }
  })
}
makeTableSortable(document.querySelector('table.submitted-papers'))

document.querySelector('th input.actions').onchange = function () {
  document.querySelectorAll('tr input.actions').forEach((elem) => {
    elem.checked = this.checked
  })
  document.querySelector('div.actions').classList.toggle('hidden', !this.checked)
}

document.querySelectorAll('td input.actions').forEach((elem) => {
  elem.onchange = () => {
    if (document.querySelectorAll('td input.actions:checked').length) {
      document.querySelector('div.actions').classList.remove('hidden')
    } else {
      document.querySelector('div.actions').classList.add('hidden')
    }
  }
  elem.onclick = (ev) => {
    const prevSelectionStart = document.querySelector('.selection-start')
    if (prevSelectionStart) {
      prevSelectionStart.classList.remove('selection-start')
      // Select all rows between the previous selection start and this one, if shift is
      // currently pressed
      if (ev.shiftKey) {
        const checkboxes = Array.from(document.querySelectorAll('tr input.actions'))
        const startIndex = checkboxes.findIndex((x) => x === prevSelectionStart)
        const endIndex = checkboxes.findIndex((x) => x === elem)
        checkboxes
          .slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1)
          .forEach((x) => { x.checked = true })
      }
    }
    if (elem.checked) {
      elem.classList.add('selection-start') // This is the new selection start
    }
  }
})

document.querySelectorAll('.collapsible-title').forEach((elem) => {
  elem.onclick = () => {
    elem.parentElement.querySelector('.collapsible-content').classList.toggle('hidden')
  }
})

document.querySelectorAll('a.load-email-template').forEach((elem) => {
  elem.onclick = () => {
    document.getElementById('subject').value = atob(elem.dataset.subject64)
    document.getElementById('body-text').value = atob(elem.dataset.body64)
    // Remove existing CC/Reply-To boxes
    document.querySelectorAll('.email-fields .remove-cc-replyto').forEach((elem) => {
      elem.previousElementSibling.remove() // <input>
      elem.previousElementSibling.remove() // <label>
      elem.remove() // <a>
    })
    // Add new ones as needed
    atob(elem.dataset.ccReplyto).split(',').filter((x) => x).forEach((email) => {
      addCCReplyTo()
      document.querySelector('.email-fields input[id^="cc-replyto"]').value = email
    })
  }
})

function setRemoveCCHandler (elem) {
  elem.onclick = () => { // Remove previous input, label, and itself
    elem.previousElementSibling.remove()
    elem.previousElementSibling.remove()
    elem.remove()
  }
}
document.querySelectorAll('.remove-cc-replyto').forEach(setRemoveCCHandler)

function addCCReplyTo () {
  let i = 0 // First unused ID
  while (document.getElementById('cc-replyto' + i)) { ++i }
  const label = document.createElement('label')
  label.setAttribute('for', 'cc-replyto' + i)
  label.innerText = 'CC and reply-to'
  const input = document.createElement('input')
  input.setAttribute('type', 'text')
  input.setAttribute('id', 'cc-replyto' + i)
  const remove = document.createElement('a')
  remove.setAttribute('href', 'javascript:;')
  remove.setAttribute('class', 'remove-cc-replyto')
  remove.innerText = 'Remove'
  setRemoveCCHandler(remove)
  document.querySelector('.add-cc-replyto').insertAdjacentElement('afterend', label)
  label.insertAdjacentElement('afterend', input)
  input.insertAdjacentElement('afterend', remove)
  input.insertAdjacentText('afterend', ' ') // Space before removal link
  setTimeout(() => input.focus(), 0)
}

document.querySelector('.add-cc-replyto').onclick = addCCReplyTo

document.getElementById('preview').onclick = function () {
  const overlay = this.parentElement.parentElement.querySelector('.overlay')
  overlay.classList.remove('hidden')
  const paperRows = getSelectedPaperRows()
  const randomRow = paperRows[Math.floor(Math.random() * paperRows.length)]
  const email = makeEmail(randomRow)
  overlay.querySelector('.email-preview-cc-replyto').innerHTML =
    'CC and reply-to: ' + email.ccReplyTo.join(', ')
  overlay.querySelector('.email-preview-subject').innerHTML =
    `<em>Subject: ${email.subject}</em>`
  overlay.querySelector('.email-preview').innerHTML = email.body
}

document.querySelectorAll('.overlay').forEach((elem) => {
  elem.onclick = () => {
    elem.classList.add('hidden')
  }
})
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    document.querySelectorAll('.overlay').forEach((elem) => {
      elem.classList.add('hidden')
    })
  }
})

document.querySelector('.email-fields input[name="pw"]').oninput = function () {
  document.getElementById('send').disabled = !this.value
}

// Send emails via ./email endpoint
document.getElementById('send').onclick = async function () {
  const outputElem = this.parentElement.querySelector('.results-output')
  outputElem.classList.remove('hidden')
  outputElem.innerHTML = ''
  this.disabled = true
  let lastCCReplyTo = []
  for (const paperRow of getSelectedPaperRows()) {
    const email = makeEmail(paperRow)
    const response = await fetch(window.location.pathname + '/email', {
      method: 'POST',
      body: new URLSearchParams({
        camera_id: paperRow.querySelector('.id a').textContent,
        ccReplyTo: email.ccReplyTo.join(','), // Can't have nested JSON
        subject: email.subject,
        body: email.body,
        pw: this.parentElement.querySelector('.email-fields input[name="pw"]').value
      })
    })
    if (response.ok) {
      if (!outputElem.innerHTML) {
        setTimeout(() => window.scrollBy(0, document.body.scrollHeight), 0)
      }
      outputElem.innerHTML += '<p>Sent email for ' +
        paperRow.querySelector('.id a').textContent + ' (' +
        paperRow.querySelector('.corresponding-email').textContent + ')</p>'
      const emailedCounter = paperRow.querySelector('.emailed')
      emailedCounter.innerText = parseInt(emailedCounter.innerText) + 1
      lastCCReplyTo = email.ccReplyTo
    } else {
      outputElem.innerHTML += '<p>Error for ' +
        paperRow.querySelector('.id a').textContent + ' (stopping)</p>'
      alert('Error: ' + await response.text())
      break
    }
  }
  // Save the email template
  const response = await fetch(window.location.pathname + '/add-email-template', {
    method: 'POST',
    body: new URLSearchParams({
      pw: this.parentElement.querySelector('input[name="pw"]').value,
      ccReplyTo: lastCCReplyTo.join(','), // Cannot have nested JSON in URLSearchParams
      subject: document.getElementById('subject').value,
      body: document.getElementById('body-text').value
    })
  })
  if (response.ok) {
    outputElem.innerHTML += '<p>Saved email template</p>'
  } else {
    alert('Error saving template: ' + await response.text())
  }
  this.disabled = false
}

// Export proceedings PDFs
document.getElementById('start-pdf-export').onclick = async function () {
  this.disabled = true
  const paperRows = getSelectedPaperRows()
  const cameraIDs = paperRows.map((elem) => elem.querySelector('.id a').textContent)
  const response = await fetch(window.location.pathname + '/export-pdf', {
    method: 'POST',
    body: new URLSearchParams({
      pw: this.parentElement.querySelector('input[name="pw"]').value,
      cameraIDs: cameraIDs.join(','),
      pdfNaming: this.parentElement.querySelector('input[name="pdf-naming"]').value
    })
  })
  this.disabled = false
  if (response.ok) {
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'export-pdf.zip'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } else {
    alert('Error exporting: ' + await response.text())
  }
}

// Set page limits
document.getElementById('set-page-limits').onclick = async function () {
  this.disabled = true
  const outputElem = this.parentElement.querySelector('.results-output')
  outputElem.innerHTML = ''
  outputElem.classList.remove('hidden')
  for (const paperRow of getSelectedPaperRows()) {
    // Send one request at a time, which makes it a bit easier to implement server-side
    // and more predictable/observable for huge updates since we see each progress
    const cameraID = paperRow.querySelector('.id a').textContent
    const cameraUrl = window.location.pathname.replace('/manage/', '/metadata/') + '/' +
      cameraID
    const response = await fetch(cameraUrl + '/update', {
      method: 'POST',
      body: new URLSearchParams({
        pw: this.parentElement.querySelector('input[name="pw"]').value,
        pageLimit: this.parentElement.querySelector('input[name="page-limit"]').value
      })
    })
    if (response.ok) {
      outputElem.innerHTML += '<p>Set page limit for ' + cameraID + '</p>'
    } else {
      outputElem.innerHTML += '<p>Error setting page limit for ' + cameraID +
        ' (stopping)</p>'
      alert('Error setting page limit: ' + await response.text())
      break
    }
  }
  this.disabled = false
}

// Delete papers
document.getElementById('delete-papers').onclick = async function () {
  this.disabled = true
  const outputElem = this.parentElement.querySelector('.results-output')
  outputElem.innerHTML = ''
  outputElem.classList.remove('hidden')
  for (const paperRow of getSelectedPaperRows()) {
    // Also do one request per paper here for progress visualization
    const cameraID = paperRow.querySelector('.id a').textContent
    const cameraUrl = window.location.pathname.replace('/manage/', '/metadata/') + '/' +
      cameraID
    const response = await fetch(cameraUrl, {
      method: 'DELETE',
      body: new URLSearchParams({
        pw: this.parentElement.querySelector('input[name="pw"]').value
      })
    })
    if (response.ok) {
      outputElem.innerHTML += '<p>Deleted ' + cameraID + '</p>'
      paperRow.remove()
    } else {
      outputElem.innerHTML += '<p>Error deleting ' + cameraID + ' (stopping)</p>'
      alert('Error deleting: ' + await response.text())
      break
    }
  }
  this.disabled = false
}
document.querySelector(
  '.delete-papers input[name="confirm-delete"]').oninput = function () {
  document.getElementById('delete-papers').disabled = this.value !== 'DELETE'
}

document.querySelector('.change-track input[type="text"]').oninput = function () {
  document.getElementById('change-track').disabled = !this.value
}

document.getElementById('change-track').onclick = async function () {
  this.disabled = true
  const outputElem = this.parentElement.querySelector('.results-output')
  outputElem.innerHTML = ''
  outputElem.classList.remove('hidden')
  for (const paperRow of getSelectedPaperRows()) {
    const cameraID = paperRow.querySelector('.id a').textContent
    const cameraUrl = window.location.pathname.replace('/manage/', '/metadata/') + '/' +
      cameraID
    const response = await fetch(cameraUrl + '/update', {
      method: 'POST',
      body: new URLSearchParams({
        pw: this.parentElement.querySelector('input[name="pw"]').value,
        track: this.parentElement.querySelector('input[name="track"]').value
      })
    })
    if (response.ok) {
      outputElem.innerHTML += '<p>Changed track for ' + cameraID + '</p>'
      paperRow.querySelector('.track').innerHTML =
        this.parentElement.querySelector('input[name="track"]').value
    } else {
      outputElem.innerHTML += '<p>Error changing track for ' + cameraID +
        ' (stopping)</p>'
      alert('Error changing track: ' + await response.text())
      break
    }
  }
  this.disabled = false
}

function getSelectedPaperRows () {
  return Array.from(
    document.querySelectorAll('table.submitted-papers tbody tr')).filter(
    (elem) => elem.querySelector('input.actions').checked)
}

function makeEmail (tableRow) {
  const authorList = tableRow.querySelector('td.authors').textContent.split(';')
  const authors = authorList.map((author, i) => {
    if (author.includes(',')) { // Reverse parts (first and last name)
      author = author.split(',').reverse().join(' ')
    }
    if (i > 0 && i === authorList.length - 1) { // Add "and" before last author
      return 'and ' + author.trim()
    }
    return author.trim()
  })
  const authorNames = authors.length > 2 ? authors.join(', ') : authors.join(' ')
  const venue = window.location.pathname.split('/').slice(-1)[0]
  function placeholders (text) {
    return text.replace('{AUTHORS}', authorNames)
      .replace('{NUM}', tableRow.querySelector('.paper-num').textContent)
      .replace('{TITLE}', tableRow.querySelector('.title').textContent)
      .replace('{TRACK}', tableRow.querySelector('.track').innerHTML)
      .replace('{VENUE}', venue)
      .replace('{PAPER_URL}', tableRow.querySelector('.id a').href)
  }
  return {
    ccReplyTo: Array.from(document.querySelectorAll('input[id^="cc-replyto"]'))
      .map((elem) => elem.value).filter((email) => email),
    subject: placeholders(document.getElementById('subject').value),
    body: placeholders(document.getElementById('body-text').value)
  }
}
