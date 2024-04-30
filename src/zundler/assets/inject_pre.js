/*
 * This file will be inserted as the first child of the iframe's <head>
 * after `common.js` and the definition of the global context.
 */

/*
 * Monkeypatch URLSearchParams
 *
 * Sphinx documents that use `searchtool.js` rely on passing information via
 * GET parameters (aka search parameters). Unfortunately, this doesn't work
 * in our approach due to the same origin policy, so we have to get ...
 * creative.
 *
 * Here, we patch the `URLSearchParams` class so it returns the information
 * stored in `window.globalContext.getParameters`.
 *
 */

const originalGet = URLSearchParams.prototype.get;

var myGet = function (arg) {
    // If searchtools.js of sphinx is used
    if (
        window.globalContext &&
        window.globalContext.getParameters &&
        (window.location.search === "") &&
        (Array.from(this.entries()).length == 0)
    ) {
        const params = new URLSearchParams('?' + window.globalContext.getParameters);
        const result = params.get(arg);
        // console.log("Return virtual get parameter:", arg, result);
        return result;
    } else {
        const originalResult = originalGet.apply(this, [arg]);
        return originalResult;
    }
};

var myDelete = function (arg) {};

URLSearchParams.prototype.get = myGet;
URLSearchParams.prototype.delete = myDelete;

/*
 * Monkeypatch window.history
 */

var myReplaceState = function (arg1, arg2, arg3) {};
window.history.replaceState = myReplaceState;

/*
 * Monkeypatch window.fetch
 */

const { fetch: originalFetch } = window;

function waitForParentResponse(path) {
    return new Promise((resolve, reject) => {
        retrieveFile(path, file => {
            resolve(file);
        });
    });
}


window.fetch = async (...args) => {
    let [resource, config ] = args;
    var path = normalizePath(resource);
    var response;
    if (isVirtual(path)) {
        var file = await waitForParentResponse(path);
        var data = file.data;
        if (file.base64encoded) {
            data = _base64ToArrayBuffer(data);
        }
        response = new Response(data);
        response.headers.set("content-type", file.mime_type);
    } else {
        response = await originalFetch(resource, config);
    }
    return response;
};


var embedImgFromParent = function(img) {
    function setSrc(img, file) {
        if (file.mime_type == 'image/svg+xml') {
            img.setAttribute('src', "data:image/svg+xml;charset=utf-8;base64, " + btoa(file.data));
        } else {
            img.setAttribute('src', `data:${file.mime_type};base64, ${file.data}`);
        }
    };

    if (img.hasAttribute('src')) {
        const src = img.getAttribute('src');
        if (isVirtual(src)) {
            var path = normalizePath(src);
            retrieveFile(path, file => setSrc(img, file));
        };
    };
};


const observer = new MutationObserver((mutationList) => {
    // console.log("Fix mutated elements...", mutationList);
    mutationList.forEach((mutation) => {
        if (mutation.type == 'childList') {
            Array.from(mutation.target.querySelectorAll("a")).forEach( a => {
                fixLink(a);
            });
            Array.from(mutation.target.querySelectorAll("img")).forEach( img => {
                embedImgFromParent(img);
            });
            Array.from(mutation.target.querySelectorAll("form")).forEach( form => {
                fixForm(form);
            });
        }
    });
});

document.addEventListener('DOMContentLoaded', function (event) {
    observer.observe(window.document.body, {subtree: true, childList: true});
});
