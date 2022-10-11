DOWNLOAD ?= ./_download
OUTPUT ?= ./www/output

define clone_repo =
	if [ -d $(DOWNLOAD)/$(2) ] ; then \
		git -C $(DOWNLOAD)/$(2) pull ; \
	else \
		git clone --depth 1 https://github.com/$(1)/$(2) $(DOWNLOAD)/$(2) ; \
	fi
endef

define create_venv =
	if [ ! -d $(DOWNLOAD)/$(1)/venv ] ; then \
		python3 -m venv $(DOWNLOAD)/$(1)/venv ; \
	fi
endef

# Arguments:
# 1: github account
# 2: github repo
define prepare =
	$(call clone_repo,$(1),$(2))
	$(call create_venv,$(2))
	. $(DOWNLOAD)/$(2)/venv/bin/activate ; \
	pip install git+file:////$(PWD)@main
endef


help:
	@echo help


sphinx: $(OUTPUT)/sphinx.html


$(OUTPUT)/sphinx.html:
	$(call prepare,sphinx-doc,sphinx)
	NAME=sphinx ; \
	. $(DOWNLOAD)/$$NAME/venv/bin/activate ; \
	pip install $(DOWNLOAD)/$$NAME[docs] ; \
	make -C $(DOWNLOAD)/$$NAME/doc zundler ; \
	cp $(DOWNLOAD)/$$NAME/doc/_build/zundler/index.html $(OUTPUT)/$$NAME.html


cpython: $(OUTPUT)/cpython.html


$(OUTPUT)/cpython.html:
	$(call prepare,python,cpython)
	NAME=cpython ; \
	. $(DOWNLOAD)/$$NAME/venv/bin/activate ; \
	pip install -r $(DOWNLOAD)/$$NAME/Doc/requirements.txt ; \
	make -C $(DOWNLOAD)/$$NAME/Doc BUILDER=zundler SPHINXOPTS='-D zundler_root_doc=index' build ; \
	cp $(DOWNLOAD)/$$NAME/Doc/build/zundler/index.html $(OUTPUT)/$$NAME.html


myst-parser: $(OUTPUT)/myst-parser.html


$(OUTPUT)/myst-parser.html:
	$(call prepare,executablebooks,myst-parser)
	NAME=myst-parser ; \
	. $(DOWNLOAD)/$$NAME/venv/bin/activate ; \
	pip install $(DOWNLOAD)/$$NAME[linkify,rtd] ; \
	make -C $(DOWNLOAD)/$$NAME/docs zundler ; \
	cp $(DOWNLOAD)/$$NAME/docs/_build/zundler/index.html $(OUTPUT)/$$NAME.html


flask: $(OUTPUT)/flask.html


$(OUTPUT)/flask.html:
	$(call prepare,pallets,flask)
	NAME=flask ; \
	. $(DOWNLOAD)/$$NAME/venv/bin/activate ; \
	pip install -r $(DOWNLOAD)/$$NAME/requirements/docs.txt ; \
	make -C $(DOWNLOAD)/$$NAME/docs zundler ; \
	cp $(DOWNLOAD)/$$NAME/docs/_build/zundler/index.html $(OUTPUT)/$$NAME.html


clean:
	@rm -rf $(DOWNLOAD)


all: sphinx cpython myst-parser flask

.PHONY: clean sphinx cpython myst-parser flask
