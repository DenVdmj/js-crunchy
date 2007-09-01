#!/usr/bin/smjs

load("support.js");
load("crunchy/crunchy.js");

var input = [];
var count = 0;

var line = readline();
if(/^\#\!/.test(line)) print(line);
else input.push(line);

while(true) {
	var line = readline();
	input.push(line);
	count = line ? 0 : count + 1;
	if(count > 100) break;
}

input = input.join("\n");

print(Crunchy.crunch(input));
