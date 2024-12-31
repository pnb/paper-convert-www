document.getElementById('import-file').onchange = function() {
  // When the user selects a file, open it client side in JS and parse the `email` and
  // `title` columns
  Papa.parse(this.files[0], {
    header: true,
    dynamicTyping: true,
    delimiter: ",",
    skipEmptyLines: true,
    complete: function(result) {
      if (result.errors.length) {
        alert('Parsing errors: ' + JSON.stringify(result.errors))
      }
      const tbody = document.querySelector('#import-data tbody')
      result.data.forEach((row) => {
        const newRow = document.createElement('tr')
        ;['email', 'title'].forEach((col) => {
          const td = document.createElement('td')
          td.innerText = row[col]
          newRow.append(td)
        })
        tbody.append(newRow)
      })
    }
  })
}

function validateSettings() {
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

document.querySelector('#import-settings form').onsubmit = async function(e) {
  e.preventDefault()
  if (!validateSettings()) {
    return false  // Prevent form submit
  }
  document.querySelectorAll('#import-settings input').forEach((elem) => {
    elem.disabled = true
  })
  // Run the import
  document.getElementById('import-results').classList.remove('hidden')
  const outputElem = document.getElementById('results-output')
  outputElem.innerHTML = ''
  for (const row of document.querySelectorAll('#import-data tbody tr')) {
    const paperTitle = row.querySelector('td:nth-child(2)').innerText
    const result = await fetch('/camera/import/add-one', {
      method: 'POST',
      body: new URLSearchParams({
        pw: document.getElementsByName('pw').item(0).value,
        venue: document.getElementsByName('venue').item(0).value,
        email: row.querySelector('td:nth-child(1)').innerText,
        title: paperTitle,
      }),
    })
    const message = await result.text()
    if (result.status === 409 || result.status === 200) {
      // 409 = already exists; 200 = added
      if (!outputElem.innerHTML) {  // Scroll to bottom on first output
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
  return false  // Prevent form submit
}
