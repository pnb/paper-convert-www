document.querySelectorAll('input.actions').forEach((elem) => {
  elem.onchange = () => {
    if (document.querySelectorAll('input.actions:checked').length) {
      document.querySelector('div.actions').classList.remove('hidden')
    } else {
      document.querySelector('div.actions').classList.add('hidden')
    }
  }
})
