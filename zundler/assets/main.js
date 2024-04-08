const iFrameId = 'main';

var set_favicon = function(href) {
    if (!href) {return;}
    var favicon = document.createElement("link");
    favicon.setAttribute('rel', 'shortcut icon');
    href = normalize_path(href);
    const file = window.global_context.file_tree[href];
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

var retrieve_file = function(path) {
    // console.log("Retrieving file: " + path);
    var file_tree = window.global_context.file_tree;
    var file = file_tree[path];
    if (!file) {
        console.warn("File not found: " + path);
        return "";
    } else {
        return file;
    }
};

var is_virtual = function(url) {
    // Return true if the url should be retrieved from the virtual file tree
    var _url = url.toString().toLowerCase();
    return (! (
        _url == "" ||
        _url[0] == "#" ||
        _url.startsWith('https:/') ||
        _url.startsWith('http:/') ||
        _url.startsWith('data:') ||
        _url.startsWith('about:srcdoc') ||
        _url.startsWith('blob:')
    ));
};

var split_url = function(url) {
    // Return a list of three elements: path, GET parameters, anchor
    var anchor = url.split('#')[1] || "";
    var get_parameters = url.split('#')[0].split('?')[1] || "";
    var path = url.split('#')[0];
    path = path.split('?')[0];
    let result = [path, get_parameters, anchor];
    // console.log("Split URL", url, result);
    return result;
};

var prepare = function(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    embed_js(doc);
    embed_css(doc);
    embed_imgs(doc);
    fix_links(doc);
    fix_forms(doc);
    return doc.documentElement.outerHTML;
}

var embed_js = function(doc) {
    Array.from(doc.querySelectorAll("script")).forEach( oldScript => {
        const newScript = doc.createElement("script");
        Array.from(oldScript.attributes).forEach( attr => {
            newScript.setAttribute(attr.name, attr.value);
        });
        try {
            if (newScript.hasAttribute('src') && is_virtual(newScript.getAttribute('src'))) {
                var src = newScript.getAttribute('src');
                let [path, get_parameters, anchor] = split_url(src);
                path = normalize_path(path);
                console.debug("Embed script: " + path);
                var src = retrieve_file(path).data + ' \n//# sourceURL=' + path;
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


var embed_css = function(doc) {
    Array.from(doc.querySelectorAll("link")).forEach( link => {
        if (link.getAttribute('rel') == 'stylesheet' && !link.getAttribute("href")) {
            const style = doc.createElement("style");
            var href = link.getAttribute('href');
            let [path, get_parameters, anchor] = split_url(href);
            path = normalize_path(path);
            style.textContent = retrieve_file(path).data;
            link.replaceWith(style);
        };
    });
};


var fix_links = function(doc) {
    Array.from(doc.querySelectorAll("a")).forEach( a => {
        fix_link(a);
    });
};


var fix_link = function(a) {
    if (is_virtual(a.getAttribute('href'))) {
        // a.addEventListener('click', virtual_click);
        a.setAttribute("onclick", "virtual_click(event)");
    } else if (a.getAttribute('href').startsWith('#')) {
        a.setAttribute('href', "about:srcdoc" + a.getAttribute('href'))
    } else if (!a.getAttribute('href').startsWith('about:srcdoc')) {
        // External links should open in a new tab. Browsers block links to
        // sites of different origin within an iframe for security reasons.
        a.setAttribute('target', "_blank");
    }
};


var fix_form = function(form) {
    var href = form.getAttribute('action');
    if (is_virtual(href) && form.getAttribute('method').toLowerCase() == 'get') {
        // form.addEventListener('submit', virtual_click);
        form.setAttribute("onsubmit", "virtual_click(event)");
    }
};


var fix_forms = function(doc) {
    Array.from(doc.querySelectorAll("form")).forEach( form => {
        fix_form(form);
    });
};


var embed_img = function(img) {
    if (img.hasAttribute('src')) {
        const src = img.getAttribute('src');
        if (is_virtual(src)) {
            var path = normalize_path(src);
            const file = retrieve_file(path);
            const mime_type = file.mime_type;
            if (mime_type == 'image/svg+xml') {
                img.setAttribute('src', "data:image/svg+xml;charset=utf-8;base64, " + btoa(file.data));
            } else {
                img.setAttribute('src', `data:${mime_type};base64, ${file.data}`);
            }
        };
    };
};


var embed_imgs = function(doc) {
    Array.from(doc.querySelectorAll("img")).forEach( img => {
        embed_img(img);
    });
};


var load_virtual_page = (function (path, get_params, anchor) {
    // fill the iframe with the new page
    // return True if it worked
    // return False if loading indicator should be removed right away
    const file = window.global_context.file_tree[path];
    var iframe = createIframe();

    if (!file) {
        console.error("File not found:", path, get_params, anchor);
        return false;
    }

    const data = file.data;
    window.global_context.get_parameters = get_params;

    if (file.mime_type == 'text/html') {
        const html = prepare(data);
        iframe.setAttribute("srcdoc", html);
        window.global_context.current_path = path;
        window.global_context.anchor = anchor;
        window.history.pushState({path, get_params, anchor}, '', '#');
        return true;
    } else {
        let blob = new Blob([data], {type: file.mime_type})
        var url = URL.createObjectURL(blob)
        var myWindow = window.open(url, "_blank");
        return false;
    }
});


var normalize_path = function(path) {
    // TODO remove redundant definition of this function (in inject.js)
    // make relative paths absolute
    var result = window.global_context.current_path;
    result = result.split('/');
    result.pop();
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
    // console.log(`Normalized path: ${path} -> ${result} (@${window.global_context.current_path})`);
    return result;
};


window.onload = function() {
    // Set up message listener
    window.addEventListener("message", (evnt) => {
        console.log("Received message in parent", evnt);
        if (evnt.data.action == 'set_title') {
            // iframe has finished loading and sent us its title
            // parent sets the title and responds with the global_context object
            window.document.title = evnt.data.argument.title;
            set_favicon(evnt.data.argument.favicon);
            var iframe = document.getElementById(iFrameId);
            iframe.contentWindow.postMessage({
                action: "set_data",
                argument: window.global_context,
            }, "*");
        } else if (evnt.data.action == 'virtual_click') {
            // user has clicked on a link in the iframe
            show_loading_indictator();
            var loaded = load_virtual_page(
                evnt.data.argument.path,
                evnt.data.argument.get_parameters,
                evnt.data.argument.anchor,
            );
            if (!loaded) {
                hide_loading_indictator();
            }
        } else if (evnt.data.action == 'show_iframe') {
            // iframe finished fixing the document and is ready to be shown;
            hide_loading_indictator();
            var iframe = document.getElementById(iFrameId);
            iframe.contentWindow.postMessage({
                action: "scroll_to_anchor",
            }, "*");
        }
    }, false);

    // Set up history event listener
    window.addEventListener("popstate", (evnt) => {
        load_virtual_page(evnt.state.path, evnt.state.get_params, evnt.state.anchor);
    });

    // Load first page
    load_virtual_page(window.global_context.current_path, "", "");
}


var show_loading_indictator = function() {
    var iframe = document.getElementById(iFrameId);
    iframe.remove()
    var loading = document.getElementById('loading-indicator');
    loading.style.display = '';
}


var hide_loading_indictator = function() {
    var iframe = document.getElementById(iFrameId);
    iframe.style.display = '';
    var loading = document.getElementById('loading-indicator');
    loading.style.display = 'none';
}

//# sourceURL=main.js
