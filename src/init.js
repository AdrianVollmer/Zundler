var _ArrayBufferToBase64 = function (array_buffer) {
    var binary = '';
    var bytes = new Uint8Array(array_buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary);
};


var _base64ToArrayBuffer = function (base64) {
    if (!base64) { return []}
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
};

var createIframe = function() {
    var iframe = document.getElementById('main');
    if (iframe) { iframe.remove() };
    iframe = document.createElement("iframe");
    window.document.body.prepend(iframe);
    iframe.setAttribute('src', '#');
    iframe.setAttribute('name', 'main');
    iframe.setAttribute('id', 'main');
    iframe.style.display = 'none';
    return iframe;
}

var load_virtual_page = (function (path, get_params, anchor) {
    const data = window.data.file_tree[path];
    var iframe = createIframe();
    if (get_params) { iframe.src = path + '?' + get_params; }
    else { iframe.src = path; }
    iframe.contentDocument.write(data);
    if (anchor) { iframe.contentDocument.location.hash = anchor; }
    window.data.current_path = path;
});

window.onload = function() {
    // Set up the virtual file tree
    var FT = window.data.file_tree;
    FT = _base64ToArrayBuffer(FT);
    FT = pako.inflate(FT)
    FT = new TextDecoder("utf-8").decode(FT);
    FT = JSON.parse(FT);
    window.data.file_tree = FT;

    // Set up message listener
    window.addEventListener("message", (evnt) => {
        console.log("Received message in parent", evnt);
        if (evnt.data.action == 'set_title') {
            // iframe has finished loading and sent us its title
            // parent sets the title and responds with the data object
            window.document.title = evnt.data.argument;
            var iframe = document.getElementById('main');
            iframe.contentWindow.postMessage({
                action: "set_data",
                argument: window.data,
            }, "*");
        } else if (evnt.data.action == 'virtual_click') {
            // user has clicked on a link in the iframe
            var iframe = document.getElementById('main');
            iframe.remove()
            var loading = document.getElementById('loading-indicator');
            loading.style.display = '';
            load_virtual_page(
                evnt.data.argument.path,
                evnt.data.argument.get_parameters,
                evnt.data.argument.anchor,
            );
        } else if (evnt.data.action == 'show_iframe') {
            // iframe finished fixing the document
            var iframe = document.getElementById('main');
            iframe.style.display = '';
            var loading = document.getElementById('loading-indicator');
            loading.style.display = 'none';
        }
    }, false);

    // Load first page
    load_virtual_page(window.data.current_path, "", "");
}
