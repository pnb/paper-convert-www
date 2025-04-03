function hidePreviousAttempts () {
  const titles = document.querySelectorAll('.title')
  for (let i = 0; i < titles.length; ++i) {
    if (i > 0 && titles.item(i).textContent === titles.item(i - 1).textContent) {
      // Previous row should be marked hidden as hidden since rows with the same title
      // are in increasing order by time
      titles.item(i - 1).parentElement.classList.add('hidden')
    }
  }
}

if (document.getElementById('chk-only-latest').checked) {
  // Page was refreshed or something and the checkbox is already checked
  hidePreviousAttempts()
}

document.getElementById('chk-only-latest').onchange = (e) => {
  if (e.target.checked) {
    hidePreviousAttempts()
  } else {
    document.querySelectorAll('tr.hidden')
      .forEach((row) => row.classList.remove('hidden'))
  }
}
