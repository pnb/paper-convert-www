/* global alert, Papa */ // ESLint

const submissions = []
const authors = []

document.getElementById('submissions-file').onchange = function () {
  submissions.length = 0
  const cols = ['#', 'track name', 'title']
  Papa.parse(this.files[0], {
    header: true,
    dynamicTyping: true,
    delimiter: ',',
    skipEmptyLines: true,
    complete: function (result) {
      if (result.errors.length) {
        alert('Parsing errors: ' + JSON.stringify(result.errors))
      }
      for (const row of result.data) {
        for (const col of cols) {
          if (!Object.prototype.hasOwnProperty.call(row, col)) {
            alert('Submissions CSV must have column: ' + col)
            return
          }
        }
        submissions.push(row)
      }
      if (submissions.length && authors.length) {
        updateImportedDataTable()
      }
    }
  })
}

document.getElementById('authors-file').onchange = function () {
  authors.length = 0
  const cols = ['submission #', 'first name', 'last name', 'email', 'corresponding?']
  Papa.parse(this.files[0], {
    header: true,
    dynamicTyping: true,
    delimiter: ',',
    skipEmptyLines: true,
    complete: function (result) {
      if (result.errors.length) {
        alert('Parsing errors: ' + JSON.stringify(result.errors))
      }
      for (const row of result.data) {
        for (const col of cols) {
          if (!Object.prototype.hasOwnProperty.call(row, col)) {
            alert('Authors CSV must have column: ' + col)
            return
          }
        }
        authors.push(row)
      }
      if (submissions.length && authors.length) {
        updateImportedDataTable()
      }
    }
  })
}

function updateImportedDataTable () {
  const tbody = document.querySelector('#import-data tbody')
  tbody.innerHTML = ''
  for (const submission of submissions) {
    const authorRows = authors.filter((a) => a['submission #'] === submission['#'])
    if (!authorRows.length) {
      alert('Stopping! No authors found for submission #' + submission['#'])
      return
    }
    const newRow = document.createElement('tr')
    const paperNumCell = document.createElement('td')
    paperNumCell.innerText = submission['#']
    paperNumCell.classList.add('paper-num')
    newRow.append(paperNumCell)
    const trackCell = document.createElement('td')
    trackCell.innerText = submission['track name']
    trackCell.classList.add('track')
    newRow.append(trackCell)
    const authorsCell = document.createElement('td')
    authorsCell.innerText = authorRows
      .map((a) => a['first name'] + ' ' + a['last name'])
      .join('; ')
    authorsCell.classList.add('authors')
    newRow.append(authorsCell)
    const correspondingEmailCell = document.createElement('td')
    correspondingEmailCell.innerText = authorRows
      .filter((a) => a['corresponding?'] === 'yes')
      .map((a) => a.email)
      .join('; ')
    correspondingEmailCell.classList.add('corresponding-email')
    newRow.append(correspondingEmailCell)
    const titleCell = document.createElement('td')
    titleCell.innerText = submission.title
    titleCell.classList.add('title')
    newRow.append(titleCell)
    tbody.append(newRow)
  }
}

function validateSettings () {
  if (!document.querySelector('#import-data td')) {
    alert('You must load the import data first.')
    return false
  }
  const venue = document.getElementsByName('venue').item(0)
  if (!/^[a-z0-9]+$/.test(venue.value)) {
    alert('Venue name must be only lowercase letters a-z and numbers.')
    venue.focus()
    return false
  }
  const password = document.getElementsByName('pw').item(0)
  if (!password.value.length) {
    alert('Password cannot be blank')
    password.focus()
    return false
  }
  return true
}

document.querySelector('#import-settings form').onsubmit = async function (e) {
  e.preventDefault()
  if (!validateSettings()) {
    return false // Prevent form submit
  }
  document.querySelectorAll('#import-settings input').forEach((elem) => {
    elem.disabled = true
  })
  // Run the import
  document.getElementById('import-results').classList.remove('hidden')
  const outputElem = document.querySelector('.results-output')
  outputElem.innerHTML = ''
  const venue = document.getElementsByName('venue').item(0).value
  for (const row of document.querySelectorAll('#import-data tbody tr')) {
    const paperTitle = row.querySelector('.title').innerText
    const result = await fetch('/camera/import/add-one', {
      method: 'POST',
      body: new URLSearchParams({
        pw: document.getElementsByName('pw').item(0).value,
        venue,
        paper_num: row.querySelector('.paper-num').innerText,
        track: row.querySelector('.track').innerText,
        authors: row.querySelector('.authors').innerText,
        corresponding_email: row.querySelector('.corresponding-email').innerText,
        title: paperTitle
      })
    })
    const message = await result.text()
    if (result.status === 409 || result.status === 200) {
      // 409 = already exists; 200 = added
      if (!outputElem.innerHTML) { // Scroll to bottom on first output
        window.scrollTo(0, document.body.scrollHeight)
      }
      outputElem.innerText += message + ' → ' + paperTitle + '\n'
    } else {
      alert('Error running import: ' + message)
      break
    }
  }
  document.querySelectorAll('#import-settings input').forEach((elem) => {
    elem.disabled = false
  })
  // Use a <form> to make a link that is actually a POST request
  document.querySelector('#manage-results-link input[name=pw]').value =
    document.getElementsByName('pw').item(0).value
  document.querySelector('#manage-results-link form').action = './manage/' + venue
  document.querySelector('#manage-results-link a').onclick = () => {
    document.querySelector('#manage-results-link form').submit()
  }
  return false // Prevent form submit
}
