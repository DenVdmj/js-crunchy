# This Makefile is pretty much a lesson in how not to do this
# kind of thing. Please accept lots of apologies. It's a big
# pile of shite.

PREFIX = /usr/local

all : website build/crunch

CRUNCHY_FILES = crunchy/crunchy.js crunchy/common.js \
    crunchy/jsdefs.js crunchy/tokenizer.js crunchy/jsparse.js \
    crunchy/crunch.js crunchy/renameVariables.js crunchy/write.js
CRUNCH_FILES = ${CRUNCHY_FILES} crunch-stream.js

build/crunch : Makefile build ${CRUNCH_FILES}
	head -n 1 crunch-stream.js > build/crunch
	cat ${CRUNCH_FILES} | \
		grep -v "^[ \t]*load[ \t]*(" | \
		grep -v "^#!" | \
		./crunch-stream.js >> build/crunch
	chmod +x build/crunch

build :
	mkdir -p build

website : Makefile index.html ${CRUNCHY_FILES} crunchy/web.js
	mkdir -p website
	cat ${CRUNCHY_FILES} crunchy/web.js | \
		grep -v "^[ \t]*load[ \t]*(" | \
		grep -v "^#!" | \
		./crunch-stream.js > website/web-crunchy.js
	grep -v "<script src='support.js'></script>" index.html > website/index.html


install : build/crunch
	install build/crunch ${PREFIX}/bin
