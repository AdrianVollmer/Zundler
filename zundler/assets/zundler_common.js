/*
 * Functions that will be needed by several files
 */

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


