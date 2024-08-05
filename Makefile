ROOT_DIR:=$(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))
DOWNLOAD ?= $(ROOT_DIR)/_download
OUTPUT ?= $(ROOT_DIR)/docs/output
REF ?= main

define clone_repo =
	if [ -d $(DOWNLOAD)/$(2) ] ; then \
		git -C $(DOWNLOAD)/$(2) pull ; \
	else \
		git clone --depth 1 https://github.com/$(1)/$(2) $(DOWNLOAD)/$(2) ; \
	fi
endef

define create_venv =
	if [ ! -d $(DOWNLOAD)/$(1)/venv ] ; then \
		uv venv $(DOWNLOAD)/$(1)/venv ; \
	fi
endef

# Arguments:
# 1: github account
# 2: github repo
define prepare =
	$(call clone_repo,$(1),$(2))
	$(call create_venv,$(2))
	. $(DOWNLOAD)/$(2)/venv/bin/activate ; \
	uv pip install --upgrade 'zundler @ git+file:////$(ROOT_DIR)@$(REF)'
endef


help:
	@echo help


sphinx: $(OUTPUT)/sphinx.html


$(OUTPUT)/sphinx.html: Makefile
	$(call prepare,sphinx-doc,sphinx)
	NAME=sphinx ; \
	DOCS=doc ; \
	. $(DOWNLOAD)/$$NAME/venv/bin/activate ; \
	uv pip install $(DOWNLOAD)/$$NAME[docs] ; \
	make -C $(DOWNLOAD)/$$NAME/$$DOCS zundler ; \
	cp $(DOWNLOAD)/$$NAME/$$DOCS/_build/zundler/index.html $(OUTPUT)/$$NAME.html


cpython: $(OUTPUT)/cpython.html


$(OUTPUT)/cpython.html: Makefile
	$(call prepare,python,cpython)
	NAME=cpython ; \
	DOCS=Doc ; \
	. $(DOWNLOAD)/$$NAME/venv/bin/activate ; \
	uv pip install -r $(DOWNLOAD)/$$NAME/$$DOCS/requirements.txt ; \
	make -C $(DOWNLOAD)/$$NAME/$$DOCS BUILDER=zundler SPHINXOPTS='-D zundler_root_doc=index' build ; \
	cp $(DOWNLOAD)/$$NAME/$$DOCS/build/zundler/index.html $(OUTPUT)/$$NAME.html


myst-parser: $(OUTPUT)/myst-parser.html


$(OUTPUT)/myst-parser.html: Makefile
	$(call prepare,executablebooks,myst-parser)
	NAME=myst-parser ; \
	DOCS=docs ; \
	. $(DOWNLOAD)/$$NAME/venv/bin/activate ; \
	uv pip install $(DOWNLOAD)/$$NAME[linkify,rtd] ; \
	make -C $(DOWNLOAD)/$$NAME/$$DOCS zundler ; \
	cp $(DOWNLOAD)/$$NAME/$$DOCS/_build/zundler/index.html $(OUTPUT)/$$NAME.html



flask: $(OUTPUT)/flask.html


$(OUTPUT)/flask.html: Makefile
	$(call prepare,pallets,flask)
	NAME=flask ; \
	DOCS=docs ; \
	. $(DOWNLOAD)/$$NAME/venv/bin/activate && \
	uv pip install -r $(DOWNLOAD)/$$NAME/requirements/docs.txt && \
	uv pip install -e $(DOWNLOAD)/$$NAME && \
	make -C $(DOWNLOAD)/$$NAME/$$DOCS zundler SPHINXOPTS='-D zundler_append_post="window.addEventListener(\"load\", function(){window.document.querySelector(\"#searchbox\").style.display=\"\"});"' && \
	cp $(DOWNLOAD)/$$NAME/$$DOCS/_build/zundler/index.html $(OUTPUT)/$$NAME.html


setuptools: $(OUTPUT)/setuptools.html


$(OUTPUT)/setuptools.html: Makefile
	$(call prepare,pypa,setuptools)
	NAME=setuptools ; \
	DOCS=docs ; \
	. $(DOWNLOAD)/$$NAME/venv/bin/activate && \
	uv pip install -e $(DOWNLOAD)/$$NAME[docs] && \
	cd $(DOWNLOAD)/$$NAME/$$DOCS && \
	sphinx-build -b zundler . _build/zundler && \
	cp _build/zundler/index.html $(OUTPUT)/$$NAME.html


readthedocs: $(OUTPUT)/readthedocs.html


$(OUTPUT)/readthedocs.html: Makefile
	$(call prepare,readthedocs,readthedocs.org)
	NAME=readthedocs.org ; \
	DOCS=docs ; \
	. $(DOWNLOAD)/$$NAME/venv/bin/activate && \
	uv pip install -r $(DOWNLOAD)/$$NAME/requirements/docs.txt && \
	cd $(DOWNLOAD)/$$NAME/$$DOCS && \
	sphinx-build -b zundler . _build/zundler && \
	cp _build/zundler/index.html $(OUTPUT)/$$NAME.html


clean:
	@rm -rf $(DOWNLOAD)


all: sphinx cpython myst-parser flask pygments setuptools

.PHONY: all clean sphinx cpython myst-parser flask pygments setuptools
