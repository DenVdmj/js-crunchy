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
			var isVar = func.body[i].type == "VAR";
			if(isVar && last) {
				func.body[i].children = func.body[i-1].children.concat(func.body[i].children);
				func.body.splice(i-1, 1);
			}
			else if(func.body[i].type == "FOR" && func.body[i].setup && func.body[i].setup.type == "VAR" && last) {
				func.body[i].setup.children = func.body[i-1].children.concat(func.body[i].setup.children);
				func.body.splice(i-1, 1);
			}
			else {
				++i;
			}
			last = isVar;
		}
	}

	// The hooks, transformations should probably be setup dynamically from
	// the options used with Crunchy.

	var transformations = {}

	function addTransformation(types, f) {
		for(var i=0; i<types.length; ++i) {
			if(transformations[types[i]])
				transformations[types[i]].push(f);
			else
				transformations[types[i]] = [f];
		}
	}

	addTransformation(["FOR_IN", "FOR", "WHILE", "DO"], trimLoopBody);
	addTransformation(["SCRIPT", "FUNCTION"], combineVars);

	Crunchy.runHooks = function(node) {
		var t = transformations[node.type];
		if(t) {
			for(var i = 0; i < t.length; ++i)
				t[i](node);
		}
		node.forChildren(Crunchy.runHooks);
	}
})()


