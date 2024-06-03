Zundler
=======

Bundle assets of distributed HTML docs into one self-contained HTML file.
It's built with Sphinx in mind, but can be used on all HTML docs.

> [!WARNING]
> This is still experimental. Expect breakages! Feel free
> to open an issue. Please provide everything that is necessary to reproduce
> the problem.

Naively building one HTML file out of a directory of HTML files that total
dozens of megabytes quickly overwhelm modern browsers. Zundler solves this
by taking the following approach:

* Embed all assets that are referenced in CSS files, such as imports and
  fonts
* Endow all HTML files with extra scripts that embed these resources at run time:
  * Convert `script` tags with a `src` attribute referencing a local JavaScript file to inline scripts
  * Convert `link` tags with an `href` attribute referencing a local CSS file to inline styles
  * Make all `img` tags with a `src` attribute referencing local images use a data URI
  * Monkey patch the JavaScript function `fetch` so requests to local files are turned into queries of the "virtual file tree" (see next item)
  * Monkey patch the JavaScript class `URLSearchParams` so GET requests to
    local files can be handeled; this is needed for Sphinx' search function, for example
* Create a JSON structure (the "global context") out of all files in the directory (the "virtual file tree") and other data
* Gzip the global context and base64-encode it
* Bundle it all into a scuffolding file with this structure:
  ```html
  <!DOCTYPE html><html>
  <head><style>{style}</style></head>
  <body>{body}
  <script>window.global_context = {zipped_global_context}</script>
  <script>{pako} //# sourceURL=pako.js</script>
  <script>{init_js} //# sourceURL=init.js</script>
  </body></html>
  ```
  The global context is then unzipped using the Pako library, an `iframe` is
  created and the document is bootstrapped from the virtual file tree.

The output file is usually smaller than the sum of all input files despite
some resources being embedded redundantly and the 33% overhead of the base64
encoding.


Limitations
-----------

This approach is quite hacky, but it might work well enough for some purposes.

* Some scripts may break as the execution flow is different than some scripts
  expect
* HTML forms with `method="GET"` to local HTML files only work if the
  receiving code uses URLSearchParams, as same-origin policies forbid
  reading GET parameters otherwise
* Opening links in a new tab won't work
* Redirections won't work (yet)
* Support of themes or extensions that require jQuery is wonky; fortunately
  Sphinx stopped supporting jQuery in version 6


Installation
------------

Zundler is a Python package and can be installed like any other Python
package.

The recommended way is to run this:

```shell-session
$ pip install zundler
```

If you prefer an alternative like `pipx`, `poetry` or manually handled
`venv`s, you probably know what to do.

An entry point called `zundler` will appear in `~/.local/bin`.


Building from source
------------

Install `hatch` by

`pip install hatch`

Then run

`make clean`
`make build`

Move into the `dist` folder

`pip install zundler-yourproducedfilename.whl`



Bundling Sphinx docs
--------------------

The Zundler package provides a Sphinx extension that adds an appropriate
builder. The builder is a thin wrapper around the HTML builder, which runs
`zundler` at the end. It can be used with `sphinx-build -b zundler` or, if
there is a suitable Makefile, with `make zundler`.

Jupyter-Books can be built with `jupyter-book build --custom-builder
zundler --builder custom .`. You may have to add a render priority for Zundler like
[here](https://jupyterbook.org/en/stable/content/code-outputs.html#render-priority):

```yaml
sphinx:
  config:
    nb_mime_priority_overrides: [
      ["zundler", "application/vnd.jupyter.widget-view+json", 10],
      ["zundler", "application/javascript", 20],
      ["zundler", "text/html", 30],
      ["zundler", "image/svg+xml", 40],
      ["zundler", "image/png", 50],
      ["zundler", "image/jpeg", 60],
      ["zundler", "text/markdown", 70],
      ["zundler", "text/latex", 80],
      ["zundler", "text/plain", 90]
    ]
```

Demos
-----

Some demo documents are available here:
<https://adrianvollmer.github.io/Zundler>


Copyright
---------

Adrian Vollmer, 2022-2024. MIT licensed; see `LICENSE` for details.
