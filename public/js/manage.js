document.querySelectorAll('input.actions').forEach((elem) => {
  elem.onchange = () => {
    if (document.querySelectorAll('input.actions:checked').length) {
      document.querySelector('div.actions').classList.remove('hidden')
    } else {
      document.querySelector('div.actions').classList.add('hidden')
    }
  }
})

document.querySelectorAll('.collapsible-title').forEach((elem) => {
  elem.onclick = () => {
    elem.parentElement.querySelector('.collapsible-content').classList.toggle('hidden')
  }
})

document.getElementById('preview').onclick = function () {
  const overlay = this.parentElement.parentElement.querySelector('.overlay')
  overlay.classList.remove('hidden')
  const paperRows = Array.from(
    document.querySelectorAll('table.submitted-papers tbody tr')).filter(
    (elem) => elem.querySelector('input.actions').checked)
  const randomRow = paperRows[Math.floor(Math.random() * paperRows.length)]
  const email = makeEmail(randomRow)
  overlay.querySelector('pre').innerHTML =
    `<em>Subject: ${email.subject}</em>\n\n${email.body}`
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
  const paperRows = Array.from(
    document.querySelectorAll('table.submitted-papers tbody tr')).filter(
    (elem) => elem.querySelector('input.actions').checked)
  outputElem.classList.remove('hidden')
  outputElem.innerHTML = ''
  this.disabled = true
  for (const paperRow of paperRows) {
    const email = makeEmail(paperRow)
    const response = await fetch(window.location.pathname + '/email', {
      method: 'POST',
      body: new URLSearchParams({
        camera_id: paperRow.querySelector('.id a').textContent,
        subject: email.subject,
        body: email.body,
        pw: this.parentElement.querySelector('input[name="pw"]').value
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
    } else {
      outputElem.innerHTML += '<p>Error for ' +
        paperRow.querySelector('.id a').textContent + ' (stopping)</p>'
      alert('Error: ' + await response.text())
      break
    }
  }
  this.disabled = false
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
  const venue = window.location.pathname.split('/').slice(-1)[0]
  function placeholders (text) {
    return text.replace('{AUTHORS}', authors.join(', '))
      .replace('{NUM}', tableRow.querySelector('.paper-num').textContent)
      .replace('{TITLE}', tableRow.querySelector('.title').textContent)
      .replace('{VENUE}', venue)
      .replace('{PAPER_URL}', '<a href="' + tableRow.querySelector('.id a').href +
        '" target="_blank">' + tableRow.querySelector('.id a').href + '</a>')
  }
  return {
    subject: placeholders(document.getElementById('subject').value),
    body: placeholders(document.getElementById('body-text').value)
  }
}
