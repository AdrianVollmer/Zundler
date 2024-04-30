/*
 * Functions that will be needed by several files
 */

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


var isVirtual = function(url) {
    // Return true if the url should be retrieved from the virtual file tree
    var _url = url.toString().toLowerCase();
    return (! (
        _url == "" ||
        _url[0] == "#" ||
        _url.startsWith('https:/') ||
        _url.startsWith('http:/') ||
        _url.startsWith('data:') ||
        _url.startsWith('javascript:') ||
        _url.startsWith('about:srcdoc') ||
        _url.startsWith('blob:')
    ));
};


var splitUrl = function(url) {
    // Return a list of three elements: path, GET parameters, anchor
    var anchor = url.split('#')[1] || "";
    var getParameters = url.split('#')[0].split('?')[1] || "";
    var path = url.split('#')[0];
    path = path.split('?')[0];
    let result = [path, getParameters, anchor];
    // console.log("Split URL", url, result);
    return result;
};


var retrieveFileFromFileTree = function(path, callback) {
    // console.log("Retrieving file: " + path);
    var fileTree = window.globalContext.fileTree;
    var file = fileTree[path];
    if (!file) {
        console.warn("File not found: " + path);
    } else {
        callback(file);
    }
};


var retrieveFileFromParent = function(path, callback) {
    // Get the file into the iframe by messaging the parent document
    // console.log("Retrieving file from parent: " + path);

    function messageHandler(event) {
        if (event.data.action === "sendFile" && event.data.argument.path === path) {
            callback(event.data.argument.file);
            window.removeEventListener('message', messageHandler);
        }
    }

    window.addEventListener('message', messageHandler);

    window.parent.postMessage({
action: "retrieveFile",
        argument: {
            path: path,
        }
    }, '*');
};


var retrieveFile = function(path, callback) {
    if (window.globalContext.fileTree) {
        retrieveFileFromFileTree(path, callback);
    } else {
        retrieveFileFromParent(path, callback);
    }
}

var fixLink = function(a) {
    const href = a.getAttribute("href");
    if (isVirtual(href)) {
        // virtualClick will be defined in the iFrame, but fixLink may be
        // called in the parent document, so we use `onclick`, because we
        // can define the function as a string
        a.setAttribute("onclick", "virtualClick(event)");
    } else if (href.startsWith('#')) {
        a.setAttribute('href', "about:srcdoc" + a.getAttribute('href'))
    } else if (
        !href.startsWith('about:srcdoc')
        && !href.startsWith('javascript:')
    ) {
        // External links should open in a new tab. Browsers block links to
        // sites of different origin within an iframe for security reasons.
        a.setAttribute('target', "_blank");
    }
};


var fixForm = function(form) {
    var href = form.getAttribute('action');
    if (isVirtual(href) && form.getAttribute('method').toLowerCase() == 'get') {
        form.setAttribute("onsubmit", "virtualClick(event)");
    }
};


var embedImg = function(img) {
    if (img.hasAttribute('src')) {
        const src = img.getAttribute('src');
        if (isVirtual(src)) {
            var path = normalizePath(src);
            retrieveFile(path, file => {
                const mime_type = file.mime_type;
                if (mime_type == 'image/svg+xml') {
                    img.setAttribute('src', "data:image/svg+xml;charset=utf-8;base64, " + btoa(file.data));
                } else {
                    img.setAttribute('src', `data:${mime_type};base64, ${file.data}`);
                }
            });
        };
    };
};


var embedJs = function(doc) {
    Array.from(doc.querySelectorAll("script")).forEach( oldScript => {
        const newScript = doc.createElement("script");
        Array.from(oldScript.attributes).forEach( attr => {
            newScript.setAttribute(attr.name, attr.value);
        });
        try {
            if (newScript.hasAttribute('src') && isVirtual(newScript.getAttribute('src'))) {
                var src = newScript.getAttribute('src');
                let [path, getParameters, anchor] = splitUrl(src);
                path = normalizePath(path);
                console.debug("Embed script: " + path);
                retrieveFile(path, file => {
                    var src = file.data + ' \n//# sourceURL=' + path;
                    newScript.appendChild(doc.createTextNode(src));
                    newScript.removeAttribute('src');
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
            }
        } catch (e) {
            // Make sure all scripts are loaded
            console.error("Caught error in " + oldScript.getAttribute("src"), e);
        }
    });
}


var embedCss = function(doc) {
    Array.from(doc.querySelectorAll("link")).forEach( link => {
        if (link.getAttribute('rel') == 'stylesheet' && link.getAttribute("href")) {
            var href = link.getAttribute('href');
            let [path, getParameters, anchor] = splitUrl(href);
            path = normalizePath(path);
            retrieveFile(path, file => {
                const style = doc.createElement("style");
                style.textContent = file.data;
                link.replaceWith(style);
            });
        };
    });
};


var fixLinks = function(doc) {
    Array.from(doc.querySelectorAll("a")).forEach( a => {
        fixLink(a);
    });
};

var fixForms = function(doc) {
    Array.from(doc.querySelectorAll("form")).forEach( form => {
        fixForm(form);
    });
};


var embedImgs = function(doc) {
    Array.from(doc.querySelectorAll("img")).forEach( img => {
        embedImg(img);
    });
};


var normalizePath = function(path) {
    // make relative paths absolute
    var result = window.globalContext.current_path;
    result = result.split('/');
    result.pop();
    // path can be a request object
    if (!(typeof path === 'string' || path instanceof String)) {
        path = path.href;
    };
    result = result.concat(path.split('/'));

    // resolve relative directories
    var array = [];
    Array.from(result).forEach( component => {
        if (component == '..') {
            if (array) {
                array.pop();
            }
        } else if (component == '.') {
        } else {
            if (component) { array.push(component); }
        }
    });

    result = array.join('/');
    // console.log(`Normalized path: ${path} -> ${result} (@${window.globalContext.current_path})`);
    return result;
};


