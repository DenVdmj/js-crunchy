// Crunchy Tokeniser. This contains some code from Narcissus:

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Narcissus JavaScript engine.
 *
 * The Initial Developer of the Original Code is
 * Brendan Eich <brendan@mozilla.org>.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// Note: there's some initilization code at the end.

Crunchy.Tokenizer = function(s, f, l) {
	for(var i in this) this[i] = this[i];
	this.source = String(s);
	this.filename = f || "";
	this.lineno = l || 1;
	this._cursor = 0;
	this._tokens = [false, false, false, false];
	this._tokenIndex = 0;
	this._lookahead = 0;
	this._scanNewlines = false;
}

Crunchy.Tokenizer.prototype = {
	//done: function() {
	//	return this.peek() == "END";
	//},

	token: function() {
		return this._tokens[this._tokenIndex];
	},

	// TODO: match/mustMatch can tell if it's an operand/operator by looking
	// at its argument.

	matchOperand: function (tt) {
		return this.getToken(true) == tt || this.unget();
	},

	matchOperator: function (tt) {
		return this.getToken(false) == tt || this.unget();
	},

	mustMatchOperand : function(tt) {
		if (!this.matchOperand(tt))
			throw this.newSyntaxError("Missing " + Crunchy.tokens[tt].toLowerCase());
		return this.token();
	},

	mustMatchOperator : function(tt) {
		if (!this.matchOperator(tt))
			throw this.newSyntaxError("Missing " + Crunchy.tokens[tt].toLowerCase());
		return this.token();
	},

	peekOperand: function() {
		return this._peek(true);
	},

	peekOperator: function() {
		return this._peek(false);
	},

	_peek: function (scanOperand) {
		var tt = this.getToken2(scanOperand);
		this.unget();
		return tt;
	},

	peekOnSameLine: function () {
		this._scanNewlines = true;
		var tt = this._peek(true);
		this._scanNewlines = false;
		return tt;
	},

	_newToken: function(type, text, value) {
		this._tokenIndex = (this._tokenIndex + 1) & 3;
		var token = this._tokens[this._tokenIndex];
		if (!token)
			this._tokens[this._tokenIndex] = token = {};
		token.type = type;
		token.text = text;
		token.value = typeof(value) === "string" ? value : text;
		token.assignOp = null;
		token.isProperty = false;
		token.scanOperand = null;
		return token;
	},

	_matchRegExp : function(regExp) {
		regExp.lastIndex = this._cursor;
		var x = regExp.exec(this.source);
		return (x && x.index == this._cursor) ? x : null;
	},

	_getKeyword : function(self, text) {
		var token = self._newToken(Crunchy.lookupKeyword(text), text)
		token.isProperty = !!Crunchy.contextuallyReservedKeywords[text];
		return token;
	},

	_getIdentifier : function(self, text) {
		var token = self._newToken("IDENTIFIER", text)
		token.isProperty = true;
		return token;
	},

	_getNumber : function(self, text) {
		// TODO: Parse number.
		return self._newToken("NUMBER", text);
	},

	_getDotNumber : function(self, text) {
		if(text.length == 1) {
			return self._getOp(self, text);
		}
		else {
			return self._newToken("NUMBER", text, parseFloat(text));
		}
	},

	_getString : function(self, text) {
		//return self._newToken("STRING", text);
		var value = text.substr(1, text.length - 2)
			.replace(/\\x[0-9a-fA-F][0-9a-fA-F]|\\.|\\\n|\\\r\n?/g, function(m) {
				if(m.length == 4) {
					return String.fromCharCode(parseInt(m.substr(2), 16));
				}
				else {
					switch(m[1]) {
						case '\\': return '\\';
						case 'b': return '\x08';
						case 't': return '\x09';
						case 'n': return '\x0a';
						case 'v': return '\x0b';
						case 'f': return '\x0c';
						case 'r': return '\x0d';
						case '\n': return '';
						case '\r': return '';
						default: return m[1];
					}
				}
			})
		return self._newToken("STRING", text, value);
		/**/
	},

	_getCommentBlock : function(self) {
		var end = self.source.indexOf("*" + "/", self._cursor + 2);
		end = end != -1 ? end + 2 : self.source.length;
		for(var x = self.source.indexOf("\n", self._cursor); x != -1 && x < end; x = self.source.indexOf("\n", x+1))
			++self.lineno;
		self._cursor = end;
	},

	_getCommentLine : function(self, text) {
		var end = self.source.indexOf("\n", self._cursor);
		if(end == -1) {
			self._cursor = self.source.length;
		}
		else {
			++self.lineno;
			self._cursor = end + 1;
		}
	},

	_getSlash : function(self, text, scanOperand) {
		if (scanOperand) {
			var match = self._matchRegExp(/\/(\\.|\[[^\]]*\]|[^\/\[])+\/[a-z]*/g);
			var x = self._newToken("REGEXP", match[0], match[0]);
		}
		else {
			var x = self._getOp(self, text);
		}
		x.scanOperand = scanOperand;
		return x;
	},

	_getOp : function(self, text) {
		if (Crunchy.assignOps[text]) {
			var token = self._newToken("ASSIGN", text);
			token.assignOp = Crunchy.assignOps[text];
			return token;
		} else {
			return self._newToken(Crunchy.opTypeNames[text], text);
		}
	},

	_getWhiteSpace : function(self, text) {
		if(!self._scanNewlines) {
			var newlines = text.match(/\n/g);
			if (newlines) {
				self.lineno += newlines.length;
			}
			self._cursor += text.length;
		}
		else {
			// TODO: That's not all the types of whitespace
			// TODO: This probably isn't needed because I'm skipping
			// whitespace in the main tokenizing regular expression.
			var match = /^[ \t]+/.exec(text);
			var pos = match ? match[0].length : 0;
			self._cursor += pos;
			if(pos < text.length) {
				self.lineno += 1;
				return self._newToken("NEWLINE", '\n');
			}
		}
		return undefined;
	},

	getOperand : function() {
		return this.getToken(true);
	},

	getOperator : function() {
		return this.getToken(false);
	},

	getToken : function(scanOperand) {
		return this.getToken2(scanOperand).type;
	},

	getToken2 : function(scanOperand) {
		while (this._lookahead) {
			--this._lookahead;
			this._tokenIndex = (this._tokenIndex + 1) & 3;
			var token = this._tokens[this._tokenIndex];
			if (token.type != "NEWLINE" || this._scanNewlines) {
				if(token.scanOperand != null && token.scanOperand != scanOperand)
					console.info("Invalid scanOperand");
				return token;
			}
		}

		do {
			if(this._cursor >= this.source.length) {
				var token = this._newToken("END");
				return token;
			}
			// TODO: What happens if source ends with non-newline whitespace?
			var match = this._matchRegExp(Crunchy._tokenRegExp);
			this._cursor += match[1].length;
			var c = match[2];
			var token = (
				this._getTokenizers["$" + c] ||
				this._subTokenizers[c.charAt(0)] ||
				this._getWhiteSpace)(this, c, scanOperand)
		} while(!token)

		this._cursor += token.text.length;
		// TODO: This doesn't work for tokens that span multiple lines.
		token.lineno = this.lineno;
		return token;
	},

	// TODO: Usually unget is not the right option - the option is to be able
	// to either: peek without changing the _tokenIndex or return to a previous
	// point.
	unget: function () {
		do {
			if (++this._lookahead == 4) throw "PANIC: too much lookahead!";
			this._tokenIndex = (this._tokenIndex - 1) & 3;
		} while(this._tokens[this._tokenIndex] && this._tokens[this._tokenIndex].type == "NEWLINE");
	},

	newSyntaxError: function (m) {
		throw {
			message : m,
			filename : this.filename,
			lineno : this.lineno,
			source : this.source,
			cursor : this._cursor,
			toString : function() { return m; }
		}
	}
}

;(function() {
	var CTp = Crunchy.Tokenizer.prototype;
	var tokenizers = CTp._getTokenizers = {};
	var subTokenizers = CTp._subTokenizers = {};

	// The subTokenizers are single characters that identify tokens that
	// can have several different forms (identifiers, numbers, etc.)

	function addSubTokenizers(from, to, tokenizer) {
		for(var i=from.charCodeAt(0), j=to.charCodeAt(0); i <=j; ++i)
			subTokenizers[String.fromCharCode(i)] = tokenizer;
	}
	addSubTokenizers("A", "Z", CTp._getIdentifier);
	addSubTokenizers("a", "z", CTp._getIdentifier);
	subTokenizers["_"] = CTp._getIdentifier;
	subTokenizers["$"] = CTp._getIdentifier;
	addSubTokenizers("0", "9", CTp._getNumber);
	subTokenizers["."] = CTp._getDotNumber;
	subTokenizers["'"] = CTp._getString;
	subTokenizers['"'] = CTp._getString;

	// tokenizers can take arbitrary identifiers - which might be members
	// of object.prototype (or worse still __proto__). So need to add a prefix
	// to all members to keep it safe.
	tokenizers['$//'] = CTp._getCommentLine;
	tokenizers['$/*'] = CTp._getCommentBlock;

	// The commented out regExpParts stuff has been replaced with a hand
	// coded regular expression. It would be nice to be able to generate
	// a fairly effecient regular expression automatically - this would
	// make it easier to add new tokens. I suppose I could build a trie
	// from the possible tokens, and generate a regular expression from that.
	//
	// Build a regexp that recognizes operators and punctuators (except
	// newline).  Workaround: Konqueror doesn't support the $& notation for
	// getting the match (is that a Seamonkey extension?)
	//
	//function regExpEscape(text) {
	//	return text.replace(/([?|^&(){}\[\]+\-*\/\.])/g, "\\$1");
	//}

	//var regExpParts = [];

	for(var i=0; i < Crunchy.tokens.length; ++i) {
		var t = Crunchy.tokens[i];
		if(/^[a-z]/.test(t)) { // Keywords
			// Note: no need to add keywords to the regular expression, as
			// the matcher for identifiers will pick them up.
			tokenizers["$" + t] = CTp._getKeyword;
		}
		else if(/^[^A-Z\n]/.test(t)) { // Operators
			//if(t.length > 1)
			//	regExpParts.push(regExpEscape(t));
			tokenizers["$" + t] = t[0] == "/" ? CTp._getSlash : CTp._getOp;
		}
	}

	for (var i=0; i < Crunchy.assignOps.length; ++i) {
		t = Crunchy.assignOps[i];
		//regExpParts.push(regExpEscape(t) + '=')
		tokenizers["$" + t + '='] = t[0] == "/" ? CTp._getSlash : CTp._getOp;
	}

	//regExpParts.push(regExpEscape("//"));
	//regExpParts.push(regExpEscape("/*"));

	// Workaround: Konqueror's sort has a different lexical ordered to its
	// comparison function.
	//function compare(x, y) { return x > y ? 1 : x < y ? -1 : 0; }
	//regExpParts = regExpParts.sort(compare).reverse();

	// TODO: Probably some others...
	// TODO: The floating point numbers will need to appear before the operators.
	//regExpParts.push("\\.\\d+(?:[eE][-+]?\\d+)?", "[a-zA-Z_$][\\w$]*", "[\\s\n\r]+", "\\d+\\.?\\d*(?:[eE][-+]?\\d+)?",
	//  "'(?:\\\\.|[^'])*'", '"(?:\\\\.|[^"])*"', "0[xX][\\da-fA-F]+", ".");

	// TODO: Do some kind of survery about which token types appear most often.
	var regExpParts = [
		"[a-zA-Z_$][\\w$]*",              // identifiers & keywords
		"[\n\r][\\s\n\r]*",               // whitespace
		";(?:;;)?",                       // ;, ;;;
		"\\.\\d*(?:[eE][-+]?\\d+)?",      // '.', floating point numbers starting with '.'
		"\\/[=\\/\\*]?",                  // /, /=, //, /*
		"\\+[+=]?",                       // +, ++, +=
		"-[-=]?",                         // -, --, -=
		"<<=?",                           // <<, <<=
		">>>?=?",                         // >>, >>>, >>=, >>>=
		"[*%<>^]=?",                      // *,*=,%,%=,<,<=,>,>=,^,^=
		"\\|[|=]?",                       // |,||,|=
		"&[&=]?",                         // &, &&, &=
		"[!=]=?=?",                       // !, !=, !==, =, ==, ===
		"'(?:\\\\.|[^'])*'",              // single quoted strings
		'"(?:\\\\.|[^"])*"',              // double quoted strings
		"0[xX][\\da-fA-F]+",              // hex numbers
		"\\d+\\.?\\d*(?:[eE][-+]?\\d+)?", // other numbers
		"."                               // any other single character
	];

	Crunchy._tokenRegExp = new RegExp("([ \t]*)(" + regExpParts.join("|") + ")", 'mg');
})();
