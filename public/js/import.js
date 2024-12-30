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
  const pathPrefix = document.getElementsByName('path-prefix').item(0)
  if (!/^[a-z0-9]+$/.test(pathPrefix.value)) {
    alert('Path prefix must be only lowercase letters a-z and numbers.')
    pathPrefix.focus()
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

document.querySelector('#import-settings form').onsubmit = function(e) {
  e.preventDefault()
  if (!validateSettings()) {
    return false
  }
  document.querySelectorAll('#import-settings input').forEach((elem) => {
    elem.disabled = true
  })
  return false
}
