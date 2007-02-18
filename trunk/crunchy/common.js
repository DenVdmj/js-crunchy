if(!this.console) console = {}
if(!console.log) console.log = function() {}
if(!console.error) console.error = function() {}

// Add missing Array functions...

new function() {
	var arrayMembers = {
		concat : function() {
			for(var r=[],i=0,o; i<arguments.length; ++i) {
				o = arguments[i];
				if(typeof(o) == Object && o.constructor == Array) {
					for(var j=0; j<o.length; ++j)
						r[r.length] = o[j];
				}
				else {
					r[r.length] = o;
				}
			}
			return r;
		},
		every : function(src, f) {
			for (var i=0, l=src.length; i<l; ++i)
				if(!f(src[i], i, src))
					return false;
			return true;
		},
		filter : function(src, f) {
			for (var r = [], i = 0, l = src.length; i<l; ++i)
				if (f(src[i], i, src)) r[r.length] = src[i];
			return r;
		},
		forEach : function(src, f) {
			for (var i = 0, l = src.length; i<l; ++i)
				f(src[i], i, src);
		},
		indexOf : function (src, i) {
			for (i = adjustIndex(src, i); i < src.length; ++i)
				if (src[i] === obj)	return i;
			return -1;
		},
		//join
		lastIndexOf : function(src, i) {
			for (i = adjustIndex(src, i); i >= 0; --i)
				if (src[i] === obj)	return i;
			return -1;
		},
		map : function(src, f) {
			for (var r=[], i=0, l=src.length; i<l; ++i)
				r[i] = f(src[i], i, src);
			return r;
		},
		slice : function(src, i, j) {
			i = adjustIndex(i);
			j = adjustIndex(j);
			for(var r=[]; i < j; ++i) r[r.length]=src[i];
			return r;
		},
		some : function(src, f) {
			for (var i=0, l=src.length; i<l; ++i)
				if(f(src[i], i, src))
					return true;
			return false;
		},
		
		// Modifying:
		
		//toSource
		//toString
		//valueOf

		pop : function(src) {
			if(src.length) {
				var tmp = src[src.length];
				--src.length;
				return tmp;
			}
		},
		push : function(src) {
			for (var i=1; i!=arguments.length; ++i)
				src[src.length] = arguments[i]
			return src;
		},
		//reverse
		shift : function(src) {
			var tmp = src[0];
			for(var i = 1; i < src.length; ++i) src[i-1] = src[i];
			--src.length;
			return tmp;
		}
		//sort
		//splice
		//unshift
	}

	// This function deals with a negative/null index.
	function adjustIndex(s, i) {
		return i == null ? 0 : i > 0 ? i : Math.max(i + s.length, 0);
	}

	// Create missing Array constructor and prototype methods.

	for(var name in arrayMembers) {
		if(!Array[name]) {
			Array[name] = /*Function.prototype.call && Array.prototype[name] ?
				genArrayClassFunction(Array.prototype[name]) :*/
				arrayMembers[name];
		}
		if(!Array.prototype[name]) {
			Array.prototype[name] = genArrayMemberFunction(arrayMembers[name]);
		} 
	}
	name = arrayMembers = null;

	function genArrayMemberFunction(f) {
		return function() {
			var a = arguments;

			switch(a.length) {
				case 0: return f(this);
				case 1: return f(this, a[0]);
				case 2: return f(this, a[0], a[1]);
				case 3: return f(this, a[0], a[1], a[2]);
				case 4: return f(this, a[0], a[1], a[2], a[3]);
				case 5: return f(this, a[0], a[1], a[2], a[3], a[4]);
				case 6: return f(this, a[0], a[1], a[2], a[3], a[4], a[5]);
				case 7: return f(this, a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
				case 8: return f(this, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7]);
				case 9: return f(this, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]);
				default: throw "Too many parameters.";
			}
		}
	}

	function genArrayClassFunction(f) {
		return function() {
			arguments.shift = Array.prototype.shift;
			return f.apply(arguments.shift(), arguments);
		}
	}
}

// Extend Array slightly with a top-of-stack method.
Array.prototype.top = function () { 
	return this.length && this[this.length-1]; 
};

String.prototype.repeat = function (n) {
	var s = "", t = this + s;
	while (--n >= 0)
		s += t;
	return s;
};
