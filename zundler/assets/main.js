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
        iframe.setAttribute("srcdoc", data);
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
