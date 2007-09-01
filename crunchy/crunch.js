;(function() {
	// Code transformation hooks

	// A simple one to start of with. If a loop body ends with 'continue' then
	// remove it. Mainly intended for something like:
	//	  while(foo(x)) continue;
	// Be carefuly not to remove continue if it has a label.
	// TODO: Maybe remove for:
	//	  bar: while(...) { ...; continue bar; }

	function trimLoopBody(loop) {
		var last = loop.body.top();
		if(last &&
			last.type == "CONTINUE" &&
			!last.label) {
			--loop.body.length;
		}
	}

	// TODO: This doesn't combine var statements inside loops/if statements/block.
	function combineVars(func) {
		var i = 0, last = false;
		while(i < func.body.length) {
			var current = func.body[i];
			if(last && last.type == current.type) {
				current.children = last.children.concat(current.children);
				func.body.splice(i-1, 1);
			}
			else if(last && current.type == "FOR" && current.setup && current.setup.type == last) {
				current.setup.children = last.children.concat(current.setup.children);
				func.body.splice(i-1, 1);
			}
			else {
				++i;
			}
			last = (current.type == "VAR" || current.type == "CONST") ? current : false;
		}
	}

	// The hooks, transformations should probably be setup dynamically from
	// the options used with Crunchy.

	var transformations = {}
	var postTransformations = {}

	function addTransformation(t, types, f) {
		for(var i=0; i<types.length; ++i) {
			if(t[types[i]])
				t[types[i]].push(f);
			else
				t[types[i]] = [f];
		}
	}

	addTransformation(transformations, ["FOR_IN", "FOR", "WHILE", "DO"], trimLoopBody);
	addTransformation(transformations, ["SCRIPT", "FUNCTION"], combineVars);

	// Concatenate strings.

	addTransformation(postTransformations, ["PLUS"], function(plus) {
		if(plus.children[0].type == "STRING" && plus.children[1].type == "STRING") {
			plus.type = "STRING";
			plus.value = plus.children[0].value + plus.children[1].value;
		}
	});

	Crunchy.runHooks = function(node) {
		var t = transformations[node.type];
		if(t) {
			for(var i = 0; i < t.length; ++i)
				t[i](node);
		}

		node.forChildren(Crunchy.runHooks);

		var t = postTransformations[node.type];
		if(t) {
			for(var i = 0; i < t.length; ++i)
				t[i](node);
		}
	}
})()


