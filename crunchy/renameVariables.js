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

(function(){
	Crunchy.renameVariables = function(root) {
		findVariables(root);
		rename(root);
		//findSpecialNames(root);
	}

	// Scopes

	var ScopeVar = function(name, scope) {
		//if(!(scope instanceof Scope))
		if(!scope)
			Crunchy.error("Creating ScopeVar without scope.");
		this.name = name;
		this.scopes = [scope];
		this.fixed = scope.mutable;
	}

	var Scope = function(parent, mutable) {
		this.parent = parent;
		this.mutable = mutable;
		this.decls = new Crunchy.Hash;
		this.refs = new Crunchy.Hash;
	}

	Scope.prototype = {
		setVars : function(parsed) {
			var decls = this.decls;
			var scope = this;

			function addVar(node) {
				if(!decls.contains(node.name)) {
					decls.insert(node.name,
						new ScopeVar(node.name, scope));
				}
			}

			parsed.varDecls.forEach(addVar);
			parsed.funDecls.forEach(addVar);
		},

		setParams : function(p) {
			var result = [];
			for(var i = 0; i < p.length; ++i) {
				var x = new ScopeVar(p[i], this);
				result[i] = x;
				this.decls.insert(p[i], x);
			}
			return result;
		},

		refVar : function(name) {
			var x = this.decls.get(name) || this.refs.get(name);
			if(!x) {
				if (this.parent) {
					x = this.refs.insert(name, this.parent.refVar(name));
					x.scopes.push(this);
					x.fixed = x.fixed || this.mutable;
				}
				else {
					x = this.decls.insert(name, new ScopeVar(name, this));
				}
			}
			return x;
		},

		setMutable : function() {
			this.decls.forEach(function(name, v) { v.fixed = true })
			this.refs.forEach(function(name, v) { v.fixed = true })
		}
	}

	// Identify the variables, and which can be changed.

	function findVariables(root) {
		var currentScope = null;
		var ScopeList = [];
		root.scopeList = ScopeList;
		loop(root);

		function loop(node, scope) {
			if(!node) return;
			if(node.constructor == Array) {
				for(var i = 0; i < node.length; ++i)
					loop(node[i]);
				return;
			}

			switch(node.type) {
			case "SCRIPT":
				// This scope is the global scope, so set it to mutable
				node.scope = new Scope(currentScope, true);
				ScopeList.push(node.scope);
				node.scope.setVars(node);
				break;
			case "FUNCTION":
				// TODO: type == GETTER/SETTER
				// TODO: functionForm?
				if(node.name) node.name2 = currentScope.refVar(node.name);
				node.scope = new Scope(currentScope, false);
				ScopeList.push(node.scope);
				node.params2 = node.scope.setParams(node.params);
				node.scope.setVars(node);
				break;
			case "IDENTIFIER":
				node.ref = currentScope.refVar(node.value);
				break;
			case "CALL":
				// Calls to eval can add variables or access variables in parent scopes.
				// So need to set them all to mutable (mutable is looking like a silly name
				// the idea was to fix names for scopes like the global scope and those
				// for with statements which can change - but in this case it has to be fixed
				// because it can be accessed by dynamic code).
				//
				// There are tons of cases that this doesn't catch but I think it
				// would be impossible to deal with them all. I can't even detect:
				//	   window.eval('var x = 1');
				// Although, that's not strictly standard ECMAscript.

				if(node.children[0].type == "IDENTIFIER" && node.children[0].value == 'eval') {
					for(var i = currentScope; i; i = i.parent)
						i.setMutable();
				}
				break;
			case "WITH":
				node.scope = new Scope(currentScope, true);
				loop(node.object);
				ScopeList.push(node.scope);
				var oldScope = currentScope;
				currentScope = node.scope;
				loop(node.body);
				currentScope = oldScope;
				return;
			case "CATCH":
				node.scope = new Scope(currentScope);
				ScopeList.push(node.scope);
				node.varRef = new ScopeVar(node.varName, node.scope);
				node.scope.decls.insert(node.varName, node.varRef);
				break;
			default:
				loop(node.children);
				return;
			}

			if(node.scope) {
				var oldScope = currentScope;
				currentScope = node.scope;
			}

			loop(node.children);

			if(oldScope) {
				currentScope = oldScope;
			}
		}
	}

	// Build up data arrays of characters to be used for generating variable
	// names.

	function addChars(first, last, array) {
		for(var i = first.charCodeAt(0), j = last.charCodeAt(0); i <= j; ++i)
			array.push(String.fromCharCode(i));
	}

	var chars1 = [];
	addChars('a', 'z', chars1);
	addChars('A', 'Z', chars1);
	var chars2 = chars1.slice();
	addChars('0', '9', chars2);

	function genName(x) {
		var name = "";
		var mod = x % chars1.length;
		name += chars1[mod];
		x = (x - mod) / chars1.length - 1;
		while(x >= 0) {
			mod = x % chars2.length;
			name += chars2[mod];
			x = (x - mod) / chars2.length - 1;
		}

		return name;
	}

	// Rename the variables from root.

	function rename(root) {
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
				if(v.fixed || v.name === "arguments") {
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
					v.mark = -1;
					variables.push(v);
				}
			});
		}

		for(var id = 0; variables.length > 0; ++id) {
			var newName = genName(id);
			if(Crunchy.lookupKeyword(newName)) continue;

			function markClashes(scopes) {
				for(var i = 0; i < scopes.length; ++i) {
					scopes[i].decls.forEach(function(index, value){
						value.mark = id;
					});
					scopes[i].refs.forEach(function(index, value){
						value.mark = id;
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
				if(!variables[i].name && variables[i].mark != id) {
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
})();
