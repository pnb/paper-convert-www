const showHelpBtns = document.getElementsByClassName('doc-warning-showhelp')
for (let i = 0; i < showHelpBtns.length; ++i) {
  showHelpBtns[i].onclick = function () {
    this.parentElement.getElementsByClassName(
      'doc-warning-help')[0].classList.remove('hidden')
    this.classList.add('hidden')
  }
}

// Show images if relevant
const extraInfos = document.getElementsByClassName('doc-warning-extra')
for (let i = 0; i < extraInfos.length; ++i) {
  const msgElem = extraInfos[i].parentElement.getElementsByClassName(
    'doc-warning-message')[0]
  if (/missing alt text/i.test(msgElem.innerHTML)) {
    const helpElem = extraInfos[i].parentElement.getElementsByClassName(
      'doc-warning-help')[0]
    const img = document.createElement('img')
    img.src = window.location.href.replace('process', 'view') + '/' +
      extraInfos[i].innerHTML
    img.alt = 'Image that is missing alt text'
    img.style['max-width'] = '20em'
    helpElem.append(document.createElement('br'))
    helpElem.append(document.createElement('br'))
    helpElem.append(img)
  }
}
