#!/usr/bin/env rhino

load("support.js");

// This requires that cruncher is called from the directory it is in. Damn.
// Unless I precrunch it...
load("crunchy/crunchy.js");

+function() {
	// Not the standard definition, but close enough.
	if(!Array.map) Array.map = function(x, f) {
		var result = [];
		for(var i = 0; i < x.length; ++i)
			result[i] = f(x[i]);
		return result;
	}
}()

main.apply(this, arguments);
function main()
{
	if(arguments.length == 0) {
		print("usage: cruncher [file]...");
		return;
	}

	try {
		// Load the files
		var scriptBody = loadFiles(Array.prototype.slice.call(arguments));
		var scripts = scriptBody.scripts;
		var body = scriptBody.body;

		if (scripts.length == 0) {
			print("Error loading files?");
			return;
		}
	} catch (e) {
		if(e.lineno) {
			print("Line " + e.lineno + ": " + e.message);
		}
		else {
			print("Error: " + (e.message || e));
		}
		return;
	}

	// Combine the scripts
	var root = Crunchy.parse("");
	for(var i = 0; i < scripts.length; ++i) {
		Array.prototype.push.apply(root.funDecls, scripts[i].funDecls);
		Array.prototype.push.apply(root.varDecls, scripts[i].varDecls);
	}
	//root.funDecls = unique(root.funDecls.sort());
	//root.varDecls = unique(root.varDecls.sort());
	root.setBody(body);

	function unique(x) {
		var result = [];
		var last;
		for(var i = 0; i < x.length; ++i) {
			if(x[i] !== last)
				result.push(last = x[i]);
		}
		return result;
	}

	// Crunch...
	Crunchy.runHooks(root);
	Crunchy.renameVariables(root);

	// And write
	print(Crunchy.write(root));

	function loadFiles(filePaths, currentPath) {
		var scripts = [], body = [];
		loadFilesImpl(filePaths, currentPath);
		return { scripts : scripts, body : body };

		function loadFilesImpl(filePaths, currentPath) {
			filePaths.forEach(function(filePath) {
				resolvedPath = resolvePath(filePath, currentPath);
				var fileContents = readFile(resolvedPath);

				// Strip out shebang (should probably save it for output...)
				fileContents = fileContents.replace(/^#!.*/, "");

				var rootNode = Crunchy.parse(fileContents);
				scripts.push(rootNode);

				rootNode.body.forEach(function(node) {
					if(node.type == "SEMICOLON" &&
						(node.expression.type == "CALL") &&
						(node.expression.children[0].type == "IDENTIFIER") &&
						(node.expression.children[0].value == "load"))
					{
						var callPaths = Array.map(
							node.expression.children[1].children,
							function(node) { return node.value; });
						loadFilesImpl(callPaths, resolvedPath);
					}
					else {
						body.push(node);
					}
				});
			});
		}
	}
}
