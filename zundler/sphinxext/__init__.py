from sphinx.builders.html import StandaloneHTMLBuilder

MAKEFILE = """
"""


class ZundlerBuilder(StandaloneHTMLBuilder):
    def handle_finish(self) -> None:
        super().handle_finish()


def setup(app):
    app.add_config_value('html_embed_assets', False, 'html')

    app.add_builder(ZundlerBuilder)

    return {
       'version': '0.1',
       'parallel_read_safe': True,
       'parallel_write_safe': True,
    }
