PACKAGE_NAME := zundler

clean:
	@rm -rf build __pycache__ *.egg-info docs/_build .docvenv .nox dist $(PACKAGE_NAME)/*.egg-info $(PACKAGE_NAME)/__pycache__

test:
	nox

build:
	hatch build

test-publish:
	@file=$$(ls -1t dist/$(PACKAGE_NAME)-*.tar.gz | head -n1); \
	read -p "[TEST] Ready to upload $$file? Type yes: " ans; \
	if [ $$ans = 'yes' ] ; then twine upload -r testpypi $$file ; fi


publish:
	@file=$$(ls -1t dist/$(PACKAGE_NAME)-*.tar.gz | head -n1); \
	read -p "Ready to upload $$file? Type yes: " ans; \
	if [ $$ans = 'yes' ] ; then twine upload $$file ; fi


.PHONY: clean docs test build publish test-publish
