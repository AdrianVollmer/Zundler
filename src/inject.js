var embed_css = function(origin) {
    Array.from(document.querySelectorAll("link")).forEach( link => {
        if (link.getAttribute('rel') == 'stylesheet') {
            const style = document.createElement("style");
            var href = link.getAttribute('href');
            let [path, get_parameters, anchor] = split_url(href);
            path = normalize_path(path);
            style.innerText = retrieve_file(path);
            link.replaceWith(style);
        };
    });
};


var embed_js = function(origin) {
    Array.from(document.querySelectorAll("script")).forEach( oldScript => {
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach( attr => {
            newScript.setAttribute(attr.name, attr.value);
        });
        try {
            if (newScript.hasAttribute('src') && is_virtual(newScript.getAttribute('src'))) {
                var src = newScript.getAttribute('src');
                let [path, get_parameters, anchor] = split_url(src);
                path = normalize_path(path);
                var src = retrieve_file(path);
                newScript.appendChild(document.createTextNode(src));
                newScript.removeAttribute('src');
                oldScript.parentNode.replaceChild(newScript, oldScript);
            }
        } catch (e) {
            // Make sure all scripts are loaded
            console.error(e);
        }
    });
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
}


var virtual_click = function(evnt) {
    // Handle GET parameters and anchors
    console.log("Virtual click", evnt);
    var el = evnt.currentTarget;
    var name = el.tagName.toLowerCase();
    if (name == 'a') {
        var [path, get_parameters, anchor] = split_url(el.getAttribute('href'));
    } else if (name == 'form') {
        var [path, get_parameters, anchor] = split_url(el.getAttribute('action'));
        const formData = new FormData(el);
        get_parameters = new URLSearchParams(formData).toString();
    } else {
        console.error("Invalid element", el);
    }
    path = normalize_path(path);

    window.parent.postMessage({
        action: "virtual_click",
        argument: {
            path: path,
            get_parameters: get_parameters,
            anchor: anchor,
        }
    }, '*');
    evnt.preventDefault();
    evnt.stopPropagation();
    return false;
};

var fix_links = function(origin) {
    Array.from(document.querySelectorAll("a")).forEach( a => {
        if (is_virtual(a.getAttribute('href'))) {
            a.addEventListener('click', virtual_click);
        }
    });
};

var fix_forms = function(origin) {
    Array.from(document.querySelectorAll("form")).forEach( form => {
        var href = form.getAttribute('action');
        if (is_virtual(href) && form.getAttribute('method').toLowerCase() == 'get') {
            form.addEventListener('submit', virtual_click);
        }
    });
};


var embed_img = function(origin) {
    Array.from(document.querySelectorAll("img")).forEach( img => {
        if (img.hasAttribute('src')) {
            const src = img.getAttribute('src');
            if (is_virtual(src)) {
                var path = normalize_path(src);
                const file = retrieve_file(path);
                // TODO handle mime type
                if (file.startsWith('<svg')) {
                    img.setAttribute('src', "data:image/svg+xml;charset=utf-8;base64, " + btoa(file));
                } else {
                    img.setAttribute('src', "data:image/png;base64, " + file);
                }
            };
        };
    });
};

var is_virtual = function(url) {
    // Return true if the url should be retrieved from the virtual file tree
    var _url = url.toString().toLowerCase();
    return (! (
        _url == "" ||
        _url[0] == "#" ||
        _url.startsWith('https://') ||
        _url.startsWith('http://') ||
        _url.startsWith('data:') ||
        _url.startsWith('blob:')
    ));
};

var retrieve_file = function(path) {
    // console.log("Retrieving file: " + path);
    var file_tree = window.data.file_tree;
    var file = file_tree[path];
    return file;
};

var normalize_path = function(path) {
    // make relative paths absolute
    var result = window.data.current_path;
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
    // console.log(`Normalized path: ${path} -> ${result} (@${window.data.current_path})`);
    return result;
};


// Set up message listener
window.addEventListener("message", (evnt) => {
    console.log("Received message in iframe", evnt);
    if (evnt.data.action == 'set_data') {
        window.data = evnt.data.argument;
        console.log("Received data from parent", window.data);
        // dynamically fix elements on this page
        try {
            embed_js(); // This might change the DOM, so do this first
            embed_css();
            fix_links();
            fix_forms();
            embed_img();
            // Trigger DOMContentLoaded again, some scripts that have just
            // been executed expect it.
            window.document.dispatchEvent(new Event("DOMContentLoaded", {
                bubbles: true,
                cancelable: true
            }));
        } finally {
            window.parent.postMessage({
                action: "show_iframe",
                argument: "",
            }, '*');
        }
    }
}, false);


// Set parent window title
window.parent.postMessage({
    action: "set_title",
    argument: window.document.querySelector('head>title').innerText
}, '*');
