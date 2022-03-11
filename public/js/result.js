var show_help_btns = document.getElementsByClassName('doc-warning-showhelp');
for (var i = 0; i < show_help_btns.length; ++i) {
    show_help_btns[i].onclick = function() {
        this.parentElement.getElementsByClassName('doc-warning-help')[0].classList.remove('hidden');
        this.classList.add('hidden');
    }
}

// Show images if relevant
var extra_infos = document.getElementsByClassName('doc-warning-extra');
for (var i = 0; i < extra_infos.length; ++i) {
    var msg_elem = extra_infos[i].parentElement.getElementsByClassName('doc-warning-message')[0];
    if (/missing alt text/i.test(msg_elem.innerHTML)) {
        var help_elem = extra_infos[i].parentElement.getElementsByClassName('doc-warning-help')[0];
        var img = document.createElement('img');
        img.src = window.location.href.replace('process', 'view') + '/' + extra_infos[i].innerHTML;
        img.alt = 'Image that is missing alt text';
        img.style['max-width'] = '20em';
        help_elem.append(document.createElement('br'));
        help_elem.append(document.createElement('br'));
        help_elem.append(img);
    }
}
