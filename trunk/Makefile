PREFIX = /usr/local

all : build/crunch

CRUNCHY_FILES = crunchy/crunchy.js crunchy/common.js \
    crunchy/jsdefs.js crunchy/tokenizer.js crunchy/jsparse.js \
    crunchy/crunch.js crunchy/renameVariables.js crunchy/write.js
CRUNCH_FILES = ${CRUNCHY_FILES} crunch-stream.js

# This sucks so much - need a decent way of running from the
# command line.
build/crunch : Makefile build ${CRUNCH_FILES}
	head -n 1 crunch-stream.js > build/crunch
	cat ${CRUNCH_FILES} | \
		grep -v "^[ \t]*load[ \t]*(" | \
		grep -v "^#!" | \
		./crunch-stream.js >> build/crunch
	chmod +x build/crunch

build :
	mkdir -p build

install : build/crunch
	install build/crunch ${PREFIX}/bin
