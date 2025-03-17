/* global getComputedStyle */ // ESLint
const timerIds = []

function resizeTable (table, maxWidth) {
  const curFontSize = getComputedStyle(table).fontSize // Computed in px
  if (table.offsetWidth > maxWidth) {
    table.style.fontSize = parseFloat(curFontSize) * 0.9 + 'px'
    // Recursivly call this to shrink the table
    // 0-millisecond timeout allows for re-render to get new offsetWidth
    timerIds.push(setTimeout(function () { resizeTable(table, maxWidth) }, 0))
  } else if (table.style.fontSize && table.offsetWidth < maxWidth * 0.85) {
    // Table is too small, which can happen after window shrink + grow
    // Restart the resizing process
    table.style.fontSize = ''
    timerIds.push(setTimeout(function () { resizeTable(table, maxWidth) }, 0))
  }
}

window.onload = function () {
  const docElem = document.querySelector('.paper-contents')
  const tables = document.getElementsByTagName('table')
  let prevWindowWidth
  window.onresize = function () {
    if (prevWindowWidth !== document.body.offsetWidth) { // Only care about width resize
      const docWidth = parseFloat(getComputedStyle(docElem).width)
      // Clear lingering timer IDs so we don't get duplicate resizes in one render cycle
      while (timerIds.length) {
        clearTimeout(timerIds.pop())
      }
      for (let i = 0; i < tables.length; ++i) {
        resizeTable(tables[i], docWidth)
      }
      prevWindowWidth = document.body.offsetWidth
    }
  }
  window.onresize()
}
