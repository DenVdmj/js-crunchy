var failures = 0;
function test(name, condition) {
	if(!condition) {
		print("Error: " + name);
		++failures;
	}
}

load("jsdefs.js");

test("Check NEWLINE", tokens[NEWLINE] === "\n");
test("BITWISE_OR", tokens[BITWISE_OR] === "|");
test("BREAK", tokens[BREAK] === "break" && lookupKeyword("break") == BREAK);

if(failures > 0) {
	print("\nFailures: " + failures);
}
