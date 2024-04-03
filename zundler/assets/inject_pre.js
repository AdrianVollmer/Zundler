/*
 * Monkeypatch URLSearchParams
 *
 * Sphinx documents that use `searchtool.js` rely on passing information via
 * GET parameters (aka search parameters). Unfortunately, this doesn't work
 * in our approach due to the same origin policy, so we have to get ...
 * creative.
 *
 * Here, we patch the `URLSearchParams` class so it returns the information
 * stored in `window.global_context.get_parameters`.
 *
 */

const originalGet = URLSearchParams.prototype.get;

var myGet = function (arg) {
    const originalResult = originalGet.apply(this, [arg]);
    // If searchtools.js of sphinx is used
    if (
        window.global_context &&
        window.global_context.get_parameters &&
        (window.location.search === "") &&
        (Array.from(this.entries()).length == 0)
    ) {
        const params = new URLSearchParams('?' + window.global_context.get_parameters);
        const result = params.get(arg);
        // console.log("Return virtual get parameter:", arg, result);
        return result;
    } else {
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

window.fetch = async (...args) => {
    let [resource, config ] = args;
    var path = normalize_path(resource);
    var response;
    if (is_virtual(path)) {
        var data = retrieve_file(path);
        response = new Response(data);

    } else {
        response = await originalFetch(resource, config);
    }
    return response;
};
