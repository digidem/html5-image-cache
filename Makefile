all: \
	node_modules/.install \
	dist/img-cache.js \
	dist/img-cache.min.js

node_modules/.install: package.json
	npm install && touch node_modules/.install

dist/img-cache.js: index.js node_modules/.install
	mkdir -p $(dir $@)
	node_modules/.bin/browserify $< -o $@

dist/img-cache.min.js: dist/img-cache.js node_modules/.install
	node_modules/.bin/uglifyjs $< -c -m -o $@
