document.getElementById('metadata-update').onsubmit = function(e) {
  // Prevent submit (happens with any button in Firefox even with no form action)
  e.preventDefault()
  return false
}

const pdfElem = document.getElementsByName('pdf').item(0)
const pdfLink = pdfElem.parentElement.querySelector('.current-file a')
pdfElem.parentElement.querySelector('button').onclick = function(e) {
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
    body: formData,
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


const titleElem = document.getElementsByName('title').item(0)
let currentTitle = titleElem.value.trim()
titleElem.oninput = function() {
  if (currentTitle === titleElem.value.trim()) {
    this.parentElement.querySelector('button').classList.add('hidden')
  } else {
    this.parentElement.querySelector('button').classList.remove('hidden')
  }
}
titleElem.parentElement.querySelector('button').onclick = async function() {
  this.disabled = true
  titleElem.disabled = true
  // Current URL is like /camera/metadata/somevenue/1234567890
  const response = await fetch(window.location.pathname + '/update', {
    method: 'POST',
    body: new URLSearchParams({
      title: titleElem.value.trim(),
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
abstractElem.oninput = function() {
  if (currentAbstract === abstractElem.value.trim()) {
    this.parentElement.querySelector('button').classList.add('hidden')
  } else {
    this.parentElement.querySelector('button').classList.remove('hidden')
  }
}
abstractElem.parentElement.querySelector('button').onclick = async function() {
  this.disabled = true
  abstractElem.disabled = true
  const response = await fetch(window.location.pathname + '/update', {
    method: 'POST',
    body: new URLSearchParams({
      abstract: abstractElem.value.trim(),
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
