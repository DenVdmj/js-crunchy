load("common.js")
load("jsdefs.js")
load("tokenizer.js")
load("jsparse.js")
load("crunchyCode.js")
var start = new Date();
parse(crunchyCode);
var end = new Date();
print("Parse time: " + (end - start));
