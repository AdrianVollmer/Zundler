/*
 * Monkeypatch URLSearchParams
 *
 * Sphinx documents that use `searchtool.js` rely on passing information via
 * GET parameters (aka search parameters). Unfortunately, this doesn't work
 * in our approach due to the same origin policy, so we have to get ...
 * creative.
 *
 * Here, we patch the `URLSearchParams` class so it returns the information
 * stored in `window.data.get_parameters`.
 *
 */

const originalGet = URLSearchParams.prototype.get;

var myGet = function (arg) {
    const originalResult = originalGet.apply(this, [arg]);
    // If searchtools.js of sphinx is used
    if (
        (arg == "q" || arg == "highlight") &&
        window.DOCUMENTATION_OPTIONS &&
        window.Scorer &&
        window.data.get_parameters &&
        (! originalResult)
    ) {
        const params = new URLSearchParams('?' + window.data.get_parameters);
        const result = params.get("q");
        return result;
    } else {
        return originalResult;
    }
};

URLSearchParams.prototype.get = myGet;

/*
 * Monkeypatch fetch
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
