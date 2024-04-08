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
    // console.log("Virtual click", evnt);

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

var is_virtual = function(url) {
    // Return true if the url should be retrieved from the virtual file tree
    var _url = url.toString().toLowerCase();
    return (! (
        _url == "" ||
        _url[0] == "#" ||
        _url.startsWith('https://') ||
        _url.startsWith('http://') ||
        _url.startsWith('data:') ||
        _url.startsWith('about:srcdoc') ||
        _url.startsWith('blob:')
    ));
};

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

var normalize_path = function(path) {
    // make relative paths absolute in context of our virtual file tree

    while (path && path[0] == '/') {
        path = path.substr(1);
    }

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


var on_set_data = function(argument) {
    window.global_context = argument;
    console.debug("Received data from parent", window.global_context);
    try {
        monkey_patch();
    } finally {
        observer.observe(window.document.body, {subtree: true, childList: true});
        window.parent.postMessage({
            action: "show_iframe",
            argument: "",
        }, '*');
    }
}


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


var embed_img = function(img) {
    if (img.hasAttribute('src')) {
        const src = img.getAttribute('src');
        if (is_virtual(src)) {
            var path = normalize_path(src);
            const file = retrieve_file(path);
            const mime_type = window.global_context.file_tree[path].mime_type;
            if (mime_type == 'image/svg+xml') {
                img.setAttribute('src', "data:image/svg+xml;charset=utf-8;base64, " + btoa(file));
            } else {
                img.setAttribute('src', `data:${mime_type};base64, ${file}`);
            }
        };
    };
};


var on_scroll_to_anchor = function(argument) {
    if (window.global_context.anchor) {
        document.location.replace("about:srcdoc#" + window.global_context.anchor);
    }
}


const observer = new MutationObserver((mutationList) => {
    // console.log("Fix mutated elements...", mutationList);
    mutationList.forEach((mutation) => {
        if (mutation.type == 'childList') {
            Array.from(mutation.target.querySelectorAll("a")).forEach( a => {
                fix_link(a);
            });
            Array.from(mutation.target.querySelectorAll("img")).forEach( img => {
                embed_img(img);
            });
            Array.from(mutation.target.querySelectorAll("form")).forEach( form => {
                fix_form(form);
            });
        }
    });
});


var monkey_patch = function() {
    if (typeof jQuery === 'undefined') {return;} // Only for jQuery at the moment
    /**
     * Monkey patch getQueryParameters
     * This function is defined in Sphinx' (v4) doctools.js and incompatible with our
     * approach.
     * This is a copy with effectively only the third line changed.
     * See: https://github.com/sphinx-doc/sphinx/blob/2329fdef8c20c6c75194f5d842b8f62ebad5c79d/sphinx/themes/basic/static/doctools.js#L54
     */
    jQuery._getQueryParameters = jQuery.getQueryParameters;
    jQuery.getQueryParameters = function(s) {
      if (typeof s === 'undefined')
        s = '?' + window.global_context.get_parameters;
      return jQuery._getQueryParameters(s);
    };

    /**
     * Monkey patch jQuery.ajax
     * Only settings.url and settings.complete are supported for virtual
     * URLs.
     */
    jQuery._ajax = jQuery.ajax;
    jQuery.ajax = function(settings) {
        url = normalize_path(settings.url);
        if (is_virtual(url)) {
            var result;
            var data;
            data = retrieve_file(url);
            result = settings.complete({responseText: data}, "");
            return; // Return value not actually needed in searchtools.js
        } else {
            return jQuery.ajax(settings);
        };
    };
}


var on_load = function() {
    // Set up message listener
    window.addEventListener("message", (evnt) => {
        console.log("Received message in iframe", evnt);
        if (evnt.data.action == 'set_data') {
            on_set_data(evnt.data.argument);
        } else if (evnt.data.action == 'scroll_to_anchor') {
            on_scroll_to_anchor(evnt.data.argument);
        }
    }, false);

    // Set parent window title and trigger data transmission
    var favicon = window.document.querySelector("link[rel*='icon']");
    if (favicon) { favicon = favicon.getAttribute('href'); }
    var title = window.document.querySelector('head>title');
    if (title) { title = title.innerText; }

    window.parent.postMessage({
        action: "set_title",
        argument: {
            title: title,
            favicon: favicon
        }
    }, '*');

};


window.addEventListener('load', on_load);
