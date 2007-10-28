;(function() {
	// Quickly hacked together hash table which avoids clashes with
	// Object.prototype, or default members such as the magnificant __proto__.
	//
	// Not suitable for general use ;)
	Crunchy.Hash = function() {
		this.hash = {}
	}

	Crunchy.Hash.prototype = {
		"prefix" : '$ crunchy $',
		"genIndex" : function(x) { return this.prefix + x; },
		"isIndex" : function(x) { return x.indexOf(this.prefix) == 0; },
		"removePrefix" : function(x) {
			return this.isIndex(x) ?
				x.substr(this.prefix.length) :
				null;
		},
		contains : function(x) { return !!this.hash[this.genIndex(x)]; },
		get : function(x) { return this.hash[this.genIndex(x)] ? this.hash[this.genIndex(x)] : false; },
		set : function(x, y) { return this.hash[this.genIndex(x)] = y; },
		insert : function(x,y) {
			var i = this.genIndex(x);
			if(this.hash[i])
				throw "Duplicate insertion into crunchy.Hash: " + x;
			else
				this.hash[i] = y;
			return y;
		},
		"forEach" : function(f) {
			for(var i in this.hash) {
				var i2 = this.removePrefix(i);
				if(i2) f(i2, this.hash[i]);
			}
		}
	}

	// Quickly hacked together hash table for associating a key with
	// multiple values.
	//
	// Not suitable for general use ;)
	// Terrible use of inheritance, I should be ashamed.

	Crunchy.MultiHash = function() { this.hashConstructor(); };
	var cmp = Crunchy.MultiHash.prototype,
		chp = Crunchy.Hash.prototype;
	cmp.hashConstructor = Crunchy.Hash;
	for(var i in chp)
		if(i != 'set') cmp[i] = chp[i];

	cmp.insert = function(x,y) {
		var i = this.genIndex(x);
		if(this.hash[i])
			this.hash[i].push(y);
		else
			this.hash[i] = [y];
		return y;
	}
})();

	Crunchy.renameVariables = function(root) {
		Crunchy.renameVariables.findVariables(root);
		Crunchy.renameVariables.rename(root);
		//findSpecialNames(root);
	}

	// Scopes

	Crunchy.renameVariables.ScopeVar = function(name, scope, node) {
		//if(!(scope instanceof Scope))
		if(!scope)
			Crunchy.error("Creating ScopeVar without scope.");
		this.name = name;
		this.scopes = [scope];
		this.stopRename = scope.fixVariableNames;
		if(node) this.node = node;
	};

	Crunchy.renameVariables.Scope = function(parent, fixVariableNames) {
		this.parent = parent;
		this.fixVariableNames = fixVariableNames;
		this.decls = new Crunchy.Hash;
		this.refs = new Crunchy.Hash;
	}

	Crunchy.renameVariables.Scope.prototype = {
		setVars : function(parsed) {
			var decls = this.decls;
			var scope = this;

			function addVar(node) {
				if(!decls.contains(node.name)) {
					decls.insert(node.name,
						new Crunchy.renameVariables.ScopeVar(node.name, scope, node));
				}
			}

			parsed.varDecls.forEach(addVar);
			parsed.funDecls.forEach(addVar);
		},

		setParams : function(p) {
			var result = [];
			for(var i = 0; i < p.length; ++i) {
				var x = new Crunchy.renameVariables.ScopeVar(p[i], this);
				result[i] = x;
				this.decls.insert(p[i], x);
			}
			return result;
		},

		refVar : function(node) {
			var x = this.decls.get(node.name) || this.refs.get(node.name);
			if(!x) {
				if (this.parent) {
					x = this.parent.refVar(node);
					x.scopes.push(this);
					x.stopRename = x.stopRename || this.fixVariableNames;
					node.unclearMatch = node.unclearMatch  || this.fixVariableNames;
				}
				else {
					x = this.decls.insert(node.name, new Crunchy.renameVariables.ScopeVar(node.name, this));
				}
			}
			return x;
		},

		setMutable : function() {
			this.decls.forEach(function(name, v) { v.stopRename = true })
			this.refs.forEach(function(name, v) { v.stopRename = true })
		}
	};

	// Identify the variables, and which can be changed.

	Crunchy.renameVariables.findVariables = function(root) {
		// Note: The rename algorithm relies on ScopeList being in
		// prefix order.
		root.scopeList = [];
		this.findVariablesLoop(root, {
			currentScope : null,
			ScopeList : root.scopeList
		});
	}

	Crunchy.renameVariables.findVariablesLoop = function(node, x, scope) {
			if(!node) return;
			if(node.constructor == Array) {
				for(var i = 0; i < node.length; ++i)
					this.findVariablesLoop(node[i], x);
				return;
			}

			switch(node.type) {
			case "SCRIPT":
				// This scope is the global scope, so fix variable names
				node.scope = new this.Scope(x.currentScope, true);
				x.ScopeList.push(node.scope);
				node.scope.setVars(node);
				break;
			case "FUNCTION":
			case "GETTER":
			case "SETTER":
				node.scope = new this.Scope(x.currentScope, false);
				x.ScopeList.push(node.scope);

				// TODO: Is this right for STATEMENT_FORM?
				if(node.type == "FUNCTION" && node.name) {
					if(node.functionForm == Crunchy.EXPRESSED_FORM) {
						node.name2 = new this.ScopeVar(node.name, node.scope);
						node.scope.decls.insert(node.name, node.name2);
					}
					else {
						node.name2 = x.currentScope.refVar(node);
					}
				}

				node.params2 = node.scope.setParams(node.params);
				node.scope.setVars(node);
				break;
			case "IDENTIFIER":
				node.ref = x.currentScope.refVar(node);

				// TODO #1: This probably shouldn't be here, should separate
				//   the variable lookup stuff from the renaming stuff.
				// TODO #2: I should really change the node, not just set a
				//   value.
				// TODO #4: 'node.ref.node != node' is a horrible hack to avoid
				//   changing the actual const statement. Surely I can do
				//   better..

				if(node.ref.node && !node.unclearMatch && node.ref.node.readOnly &&
						node.ref.node != node &&
						node.ref.node.initializer &&
						node.ref.node.initializer.type == "NUMBER") {
					node.constValue = node.ref.node.initializer;
				}
				break;
			case "CALL":
				// Calls to eval can add variables or access variables in parent scopes.
				// So need to fix the variable names in all those scopes.
				//
				// There are tons of cases that this doesn't catch but I think it
				// would be impossible to deal with them all. I can't even detect:
				//	   window.eval('var x = 1');
				// Although, that's not strictly standard ECMAscript.

				if(node.children[0].type == "IDENTIFIER" && node.children[0].value == 'eval') {
					for(var i = x.currentScope; i; i = i.parent)
						i.setMutable();
				}
				break;
			case "WITH":
				node.scope = new this.Scope(x.currentScope, true);
				this.findVariablesLoop(node.object, x);
				x.ScopeList.push(node.scope);
				var oldScope = x.currentScope;
				x.currentScope = node.scope;
				this.findVariablesLoop(node.body, x);
				x.currentScope = oldScope;
				return;
			case "CATCH":
				node.scope = new this.Scope(x.currentScope);
				x.ScopeList.push(node.scope);
				node.varRef = new this.ScopeVar(node.varName, node.scope);
				node.scope.decls.insert(node.varName, node.varRef);
				break;
			default:
				this.findVariablesLoop(node.children, x);
				return;
			}

			if(node.scope) {
				var oldScope = x.currentScope;
				x.currentScope = node.scope;
			}

			this.findVariablesLoop(node.children, x);

			if(oldScope) {
				x.currentScope = oldScope;
			}
	};

	// Build up data arrays of characters to be used for generating variable
	// names.

(function() {
	function addChars(first, last, array) {
		for(var i = first.charCodeAt(0), j = last.charCodeAt(0); i <= j; ++i)
			array.push(String.fromCharCode(i));
	}

	var chars1 = [];
	addChars('a', 'z', chars1);
	addChars('A', 'Z', chars1);
	var chars2 = chars1.slice();
	addChars('0', '9', chars2);
	Crunchy.renameVariables.chars1 = chars1;
	Crunchy.renameVariables.chars2 = chars2;
})();


	Crunchy.renameVariables.genName = function(x){
		var name = "";
		var mod = x % this.chars1.length;
		name += this.chars1[mod];
		x = (x - mod) / this.chars1.length - 1;
		while(x >= 0) {
			mod = x % this.chars2.length;
			name += this.chars2[mod];
			x = (x - mod) / this.chars2.length - 1;
		}

		return name;
	}

	// Rename the variables from root.

	Crunchy.renameVariables.rename = function(root) {
		var s = root.scopeList;
		if(!s) {
			Crunchy.error("renameVariables called for node without a scope list.");
			return;
		}

		var variables = [], fixed = new Crunchy.MultiHash;
		for(var i = 0; i < s.length; ++i) {
			s[i].decls.forEach(function(name, v) {
				// TODO: The check for arguments is a really nasty hack.
				// It does the right thing, but in the wrong way, since variables
				// are going to be matched with the wrong place. 'arguments' should
				// be caught in 'refVar', possibly by adding arguments to all function
				// scopes.
				if(v.fixed || v.stopRename || v.name === "arguments") {
					fixed.insert(name, v);
				}
				// Not bothering with 'special' names for now. Maybe deal with them optionally
				// in the future.
				//
				//else if(/^_[A-Za-z\d]/.test(v.name)) {
				//	// Do nothing for _names (I never generate clashing names)
				//}
				//else if(/\x24[a-zA-Z\x24_]/.test(v.name)) {
				//	// Reserve the abbreviated version of the name.
				//	// No need to reserve the actual name as I never generate a dollar name.
				//	var abbr = v.name.replace(/((\x24+)([a-zA-Z\x24_]+))(\d*)/g,
				//		function(name, prefix, dollars, letters, suffix) {
				//			var length = dollars.length;
				//			var start = length - Math.max(length - letters.length, 0);
				//			return name.substr(start, length) + suffix;
				//		}	
				//	);
				//	fixed.insert(abbr, v);
				//}
				else {
					v.oldName = v.name;
					delete v.name;
					v["Crunchy::rename::mark"] = -1;
					variables.push(v);
				}
			});
		}

		for(var id = 0; variables.length > 0; ++id) {
			var newName = this.genName(id);
			if(Crunchy.lookupKeyword(newName)) continue;

			function markClashes(scopes) {
				for(var i = 0; i < scopes.length; ++i) {
					scopes[i].decls.forEach(function(index, value){
						value["Crunchy::rename::mark"] = id;
					});
					scopes[i].refs.forEach(function(index, value){
						value["Crunchy::rename::mark"] = id;
					});
				}
			}

			if(fixed.contains(newName)) {
				fixed.get(newName).forEach(function(x) {
					markClashes(x.scopes);
				});
			}

			var i = 0;
			while(i < variables.length) {
				if(!variables[i].name && variables[i]["Crunchy::rename::mark"] != id) {
					variables[i].name = newName;
					markClashes(variables[i].scopes);
					variables.splice(i, 1);
				}
				else {
					++i;
				}
			}
		}
	}
