extensions = [
    'sphinx.ext.autodoc',
]

master_doc = "index"
html_theme = "furo"

autodoc_preserve_defaults = True
default_role = 'any'

# HTML theme
html_theme = 'furo'
html_logo = "images/logo.svg"

extensions += ['jaraco.tidelift']
