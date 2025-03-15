document.getElementById('btn-upload').onclick = function (e) {
  this.disabled = 'disabled'
  document.getElementById('doc-submit-form').submit()
}
