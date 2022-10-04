Zundler
=======

Bundle assets of distributed HTML docs into one self-contained HTML file.

Naively building one HTML file out of a directory of HTML files that total
dozens of megabytes quickly overwhelm modern browsers. Zundler solves this
by taking the following approach:

* Embed all assets that are referenced in CSS files, such as imports and
  fonts
* Endow all HTML files with extra scripts that embed these resources at run time:
  * Convert `script` tags with a `src` attribute referencing a JavaScript
    file to inline scripts
  * Convert `link` tags with an `href` attribute referencing a CSS file to inline styles
  * Make all `img` tags with a `src` attribute referencing local images use a data URI
  * Monkey patch the JavaScript function `fetch` and the class `URLSearchParams`
* Create a JSON structure (the "global context") out of all files in the directory (the "virtual file tree") and other data
* Gzip this scructure and base64-encode it
* Bundle it all into a scuffolding file with this structure:
  ```html
  <!DOCTYPE html>
  <html>
  <head><style>{style}</style></head>
  <body>{body}
  <script>window.global_context = {global_context}</script>
  <script>{pako} //# sourceURL=pako.js</script>
  <script>{init_js} //# sourceURL=init.js</script>
  </body></html>
  ```
  The global context is then unzipped, an `iframe` is created and the
  document is bootstrapped from the virtual file tree.


Installation
------------

Zundler is a Python package and can be installed like any other Python
package.

The recommended way is to clone this repository and type `pip install .`.
If you prefer an alternative like `pipx`, `poetry` or manually handled
`venv`s, you probably know what to do.

An entry point called `zundler` will appear in `~/.local/bin`.


Bundling Sphinx docs
--------------------

Providing a Sphinx extension does not make sense, because it would need to
add a new builder. Similar to the `latexpdf` 

Suggested Makefile addition:

```make
.PHONY: latexpdf
latexpdf:
    $(SPHINXBUILD) -b zundler $(ALLSPHINXOPTS) $(BUILDDIR)/html
    @echo "Bundle asset into one self-contained HTML file..."
    $(MAKE) -C $(BUILDDIR)/html
    @echo "Zundler finished; the HTML file is in $(BUILDDIR)/zundler."
```

Demos
-----

...


Limitations
-----------

This approach is quite hacky, but it might work well enough for your
purposes.


Copyright
---------

Adrian Vollmer, 2022. MIT licensed; see `LICENSE` for details.
