def setup(app):
    app.add_config_value('html_embed_assets', False, 'html')

    return {
       'version': '0.1',
       'parallel_read_safe': True,
       'parallel_write_safe': True,
    }
