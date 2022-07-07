var timer_ids = [];

function resize_table(table, max_width) {
    var cur_font_size = getComputedStyle(table).fontSize;  // Computed in px
    if (table.offsetWidth > max_width) {
        table.style.fontSize = parseFloat(cur_font_size) * .9 + 'px'
        // Recursivly call this to shrink the table
        // 0-millisecond timeout allows for re-render to get new offsetWidth
        timer_ids.push(setTimeout(function() {resize_table(table, max_width)}, 0));
    } else if (table.style.fontSize && table.offsetWidth < max_width * .85) {
        // Table is too small, which can happen after window shrink + grow
        // Restart the resizing process
        table.style.fontSize = '';
        timer_ids.push(setTimeout(function() {resize_table(table, max_width)}, 0));
    }
}

window.onload = function() {
    var doc_elem = document.getElementsByClassName('paper-contents').item(0);
    var tables = document.getElementsByTagName('table');
    var prev_window_width;
    window.onresize = function() {
        if (prev_window_width !== document.body.offsetWidth) {  // Only care about horizontal resize
            var doc_width = parseFloat(getComputedStyle(doc_elem).width);
            // Clear lingering timer IDs so we don't get duplicate resizes in one render cycle
            while (timer_ids.length) {
                clearTimeout(timer_ids.pop());
            }
            for (var i = 0; i < tables.length; ++i) {
                resize_table(tables[i], doc_width);
            }
            prev_window_width = document.body.offsetWidth;
        }
    }
    window.onresize();
}
