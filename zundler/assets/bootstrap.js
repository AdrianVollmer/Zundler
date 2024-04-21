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


// Set up the virtual file tree
var GC = window.globalContext;
GC = _base64ToArrayBuffer(GC);
GC = pako.inflate(GC);
GC = new TextDecoder("utf-8").decode(GC);
GC = JSON.parse(GC);
window.globalContext = GC;
eval(window.globalContext.main);
