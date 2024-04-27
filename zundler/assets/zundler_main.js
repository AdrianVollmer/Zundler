const iFrameId = 'zundler-iframe';

var retrieveFile = function(path) {
    // console.log("Retrieving file: " + path);
    var fileTree = window.globalContext.fileTree;
    var file = fileTree[path];
    if (!file) {
        console.warn("File not found: " + path);
        return "";
    } else {
        return file;
    }
};


var setFavicon = function(href) {
    if (!href) {return;}
    var favicon = document.createElement("link");
    favicon.setAttribute('rel', 'shortcut icon');
    href = normalizePath(href);
    const file = window.globalContext.fileTree[href];
    if (!file) {return;}
    if (file.mime_type == 'image/svg+xml') {
        favicon.setAttribute('href', 'data:' + file.mime_type + ';charset=utf-8;base64,' + btoa(file.data));
        favicon.setAttribute('type', file.mime_type);
    } else {
        if (file.base64encoded) {
            favicon.setAttribute('href', 'data:' + file.mime_type + ';base64,' + file.data);
        }
    }
    document.head.appendChild(favicon);
};


var createIframe = function() {
    var iframe = document.getElementById(iFrameId);
    if (iframe) { iframe.remove() };
    iframe = document.createElement("iframe");
    window.document.body.prepend(iframe);
    iframe.setAttribute('src', '#');
    iframe.setAttribute('name', iFrameId);
    iframe.setAttribute('id', iFrameId);
    // iframe.style.display = 'none';
    return iframe;
}


function deepCopyExcept(obj, skipProps) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    let result = Array.isArray(obj) ? [] : {};

    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (!skipProps.includes(key)) {
                result[key] = deepCopyExcept(obj[key], skipProps);
            }
        }
    }

    return result;
}


var prepare = function(html) {
    function unicodeToBase64(string) {
        const utf8EncodedString = unescape(encodeURIComponent(string));
        return btoa(utf8EncodedString);
    }

    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");

    // Insert the global context into the iframe's DOM, but without the file
    // tree or utils. They are not necessary; the iframe will message the
    // parent document to retrieve files.
    //
    // Convert JSON object to b64 because it contain all kinds of
    // problematic characters: `, ", ', &, </script>, ...
    // atob is insufficient, because it only deals with ASCII - we have
    // unicode
    const gcTag = doc.createElement("script");
    const strippedGC = deepCopyExcept(window.globalContext, ["fileTree", "utils"]);

    var serializedGC = unicodeToBase64(JSON.stringify(strippedGC));

    gcTag.textContent = `
        function base64ToUnicode(base64String) {
            const utf8EncodedString = atob(base64String);
            return decodeURIComponent(escape(utf8EncodedString));
        }

        window.globalContext = JSON.parse(base64ToUnicode("${serializedGC}"));
    `;

    const commonTag = doc.createElement("script");
    commonTag.textContent = window.globalContext.utils.zundler_common;
    const injectPreTag = doc.createElement("script");
    injectPreTag.textContent = window.globalContext.utils.inject_pre;
    const injectPostTag = doc.createElement("script");
    injectPostTag.textContent = window.globalContext.utils.inject_post;

    doc.head.prepend(commonTag);
    doc.head.prepend(gcTag);
    doc.head.prepend(injectPreTag);
    doc.body.append(injectPostTag);

    embedJs(doc);
    embedCss(doc);
    embedImgs(doc);

    fixLinks(doc);
    fixForms(doc);

    window.document.title = doc.title;

    return doc.documentElement.outerHTML;
}


var embedImg = function(img) {
    if (img.hasAttribute('src')) {
        const src = img.getAttribute('src');
        if (isVirtual(src)) {
            var path = normalizePath(src);
            const file = retrieveFile(path);
            const mime_type = file.mime_type;
            if (mime_type == 'image/svg+xml') {
                img.setAttribute('src', "data:image/svg+xml;charset=utf-8;base64, " + btoa(file.data));
            } else {
                img.setAttribute('src', `data:${mime_type};base64, ${file.data}`);
            }
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
                var src = retrieveFile(path).data + ' \n//# sourceURL=' + path;
                newScript.appendChild(doc.createTextNode(src));
                newScript.removeAttribute('src');
                oldScript.parentNode.replaceChild(newScript, oldScript);
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
            const style = doc.createElement("style");
            var href = link.getAttribute('href');
            let [path, getParameters, anchor] = splitUrl(href);
            path = normalizePath(path);
            style.textContent = retrieveFile(path).data;
            link.replaceWith(style);
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


var loadVirtualPage = (function (path, get_params, anchor) {
    // fill the iframe with the new page
    // return True if it worked
    // return False if loading indicator should be removed right away
    const file = window.globalContext.fileTree[path];
    var iframe = createIframe();

    if (!file) {
        console.error("File not found:", path, get_params, anchor);
        return false;
    }

    const data = file.data;
    window.globalContext.getParameters = get_params;

    // libmagic doesn't properly recognize mimetype of HTMl files that start
    // with empty lines. It thinks it's javascript. So we also consider the
    // filename when determining the file type.
    if (file.mime_type == 'text/html' || path.toLowerCase().endsWith(".html")) {
        window.globalContext.current_path = path;
        window.globalContext.anchor = anchor;
        const html = prepare(data);
        iframe.setAttribute("srcdoc", html);
        window.history.pushState({path, get_params, anchor}, '', '#');
        return true;
    } else {
        let blob = new Blob([data], {type: file.mime_type})
        var url = URL.createObjectURL(blob)
        var myWindow = window.open(url, "_blank");
        return false;
    }
});


window.onload = function() {
    // Set up message listener
    window.addEventListener("message", (evnt) => {
        console.log("Received message in parent", evnt.data);
        var iframe = document.getElementById(iFrameId);

        if (evnt.data.action == 'ready') {
            // iframe is ready
            hideLoadingIndicator();
            iframe.contentWindow.postMessage({
                action: "scrollToAnchor",
            }, "*");

        } else if (evnt.data.action == 'retrieveFile') {
            const path = evnt.data.argument.path;
            const file = retrieveFile(path);
            iframe.contentWindow.postMessage({
                action: "sendFile",
                argument: {
                    path: path,
                    file: file,
                },
            }, "*");

        } else if (evnt.data.action == 'showMenu') {
            showMenu();

        } else if (evnt.data.action == 'set_title') {
            // iframe has finished loading and sent us its title
            // parent sets the title and responds with the globalContext object
            window.document.title = evnt.data.argument.title;
            setFavicon(evnt.data.argument.favicon);

        } else if (evnt.data.action == 'virtualClick') {
            // user has clicked on a link in the iframe
            showLoadingIndicator();
            var loaded = loadVirtualPage(
                evnt.data.argument.path,
                evnt.data.argument.getParameters,
                evnt.data.argument.anchor,
            );
            if (!loaded) {
                hideLoadingIndicator();
            }
        }
    }, false);

    // Set up history event listener
    window.addEventListener("popstate", (evnt) => {
        loadVirtualPage(evnt.state.path, evnt.state.get_params, evnt.state.anchor);
    });

    // Load first page
    loadVirtualPage(window.globalContext.current_path, "", "");
}


var showLoadingIndicator = function() {
    var iframe = document.getElementById(iFrameId);
    iframe.remove()
    var loading = document.getElementById('loading-indicator');
    loading.style.display = '';
}


var hideLoadingIndicator = function() {
    var iframe = document.getElementById(iFrameId);
    iframe.style.display = '';
    var loading = document.getElementById('loading-indicator');
    loading.style.display = 'none';
}

function showMenu() {
    // TODO show the menu containing info and functions
}

document.addEventListener('keyup', function (event) {
    if (event.key == "Z" && event.ctrlKey){
        showMenu();
    }
});
