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
	//	return this.peek() === "END";
	//},

	token: function() {
		return this._tokens[this._tokenIndex];
	},

	// TODO: match/mustMatch can tell if it's an operand/operator by looking
	// at its argument.

	matchOperand: function (tt) {
		return this.getToken(true) === tt || this.unget();
	},

	matchOperator: function (tt) {
		return this.getToken(false) === tt || this.unget();
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
		return (x && x.index === this._cursor) ? x : null;
	},

	_getIdentifier : {
		matcher : /.[a-zA-Z0-9_$]*/g,
		go : function(self, text) {
			var keyword = Crunchy.lookupKeyword(text);
			var token;
			if(keyword) {
				token = self._newToken(keyword, text);
				token.isProperty = !!Crunchy.contextuallyReservedKeywords[text];
			}
			else {
				token = self._newToken("IDENTIFIER", text);
				token.isProperty = true;
			}
			return token;
		}
	},

	_getNumber : {
		matcher : /0[xX][\da-fA-F]+|.\d*\.?\d*(?:[eE][-+]?\d+)?/g,
		go: function(self, text) {
			// TODO: Parse number.
			return self._newToken("NUMBER", text);
		}
	},

	_getDotNumber : {
		matcher : /\.\d*(?:[eE][-+]?\d+)?/g,
		go: function(self, text) {
			if(text.length === 1) {
				return self._getOp(self, '.');
			}
			else {
				return self._newToken("NUMBER", text, parseFloat(text));
			}
		}
	},

	_getString : function(self, text) {
		//return self._newToken("STRING", text);
		var value = text.substr(1, text.length - 2)
			.replace(/\\x[0-9a-fA-F][0-9a-fA-F]|\\.|\\\n|\\\r\n?/g, function(m) {
				if(m.length === 4) {
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

	_getSlash : {
		matcher : /.[*/]?/g,
		go: function(self, text, scanOperand) {
			switch(text) {
				case '/*': return this._getCommentBlock(self);
				case '//': return this._getCommentLine(self);
				case '/': break;
				default: throw "Invalid slash token.";
			}

			if (scanOperand) {
				var match = self._matchRegExp(/\/(\\.|\[[^\]]*\]|[^\/\[])+\/[a-z]*/g);
				var x = self._newToken("REGEXP", match[0], match[0]);
			}
			else {
				if(self._cursor < self.source.length - 1 &&
					self.source[self._cursor + 1] === '=')
				{
					var x = self._getOp(self, '/=');
				}
				else
				{
					var x = self._getOp(self, '/');
				}
			}
			x.scanOperand = scanOperand;
			return x;
		},
		_getCommentBlock : function(self) {
			var end = self.source.indexOf("*" + "/", self._cursor + 2);
			end = end != -1 ? end + 2 : self.source.length;
			for(var x = self.source.indexOf("\n", self._cursor); x != -1 && x < end; x = self.source.indexOf("\n", x+1))
				++self.lineno;
			self._cursor = end;
		},

		_getCommentLine : function(self) {
			var end = self.source.indexOf("\n", self._cursor);
			if(end === -1) {
				self._cursor = self.source.length;
			}
			else {
				++self.lineno;
				self._cursor = end + 1;
			}
		}
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

	_getWhiteSpace : {
		go : function(self) {
			if(!self._scanNewlines) {
				var match = self._matchRegExp(/[\s\n\r]*/g);
				var text = match[0];
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
				var match = self._matchRegExp(/[ \t]*/g);
				self._cursor = self._cursor + match[0].length;
				if(self._cursor < self.source.length && self.source.charAt(self._cursor) === '\n') {
					self.lineno += 1;
					return self._newToken("NEWLINE", '\n');
				}
			}
			return undefined;
		}
	},

	getOperand : function() {
		return this.getToken(true);
	},

	getOperator : function() {
		return this.getToken(false);
	},

	getToken : function(scanOperand) {
		var r = this.getToken2(scanOperand).type;
		return r;
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
			var tokenizer = this._getTokenizers[this.source.charCodeAt(this._cursor)];
			var text = tokenizer.matcher ? this._matchRegExp(tokenizer.matcher)[0] : this.source.charAt(this._cursor);
			var token = tokenizer.go(this, text, scanOperand);
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
			if (++this._lookahead === 4) throw "PANIC: too much lookahead!";
			this._tokenIndex = (this._tokenIndex - 1) & 3;
		} while(this._tokens[this._tokenIndex] && this._tokens[this._tokenIndex].type === "NEWLINE");
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
	var tokenizers = CTp._getTokenizers = [];

	// The subTokenizers are single characters that identify tokens that
	// can have several different forms (identifiers, numbers, etc.)

	function addTokenizers() {
		switch(arguments.length) {
		case 2:
			var chars = arguments[0], tokenizer = arguments[1];
			for(var i=0, j=chars.length; i <=j; ++i)
				tokenizers[chars.charCodeAt(i)] = tokenizer;
			return;
		case 3:
			var from = arguments[0], to = arguments[1], tokenizer = arguments[2];
			for(var i=from.charCodeAt(0), j=to.charCodeAt(0); i <=j; ++i)
				tokenizers[i] = tokenizer;
			return;
		default:
			throw "Incorrect number of arguments in addSubTokenizers."
		}
	}

	addTokenizers("A", "Z", CTp._getIdentifier);
	addTokenizers("a", "z", CTp._getIdentifier);
	addTokenizers("_$", CTp._getIdentifier);
	addTokenizers("0", "9", CTp._getNumber);
	addTokenizers(".", CTp._getDotNumber);
	addTokenizers("'", { matcher: /'(?:\\.|[^'])*'/g, go: CTp._getString });
	addTokenizers('"', { matcher: /"(?:\\.|[^"])*"/g, go: CTp._getString });
	addTokenizers('\n\t ', CTp._getWhiteSpace);
	addTokenizers(';', { matcher: /;(?:;;)?/g, go: CTp._getOp });
	addTokenizers('+', { matcher: /.[+=]?/g, go: CTp._getOp });
	addTokenizers('-', { matcher: /.[-=]?/g, go: CTp._getOp });
	addTokenizers('<', { matcher: /<<?=?/g, go: CTp._getOp });
	addTokenizers('>', { matcher: />>>?=?|>=?/g, go: CTp._getOp });
	addTokenizers('*%^', { matcher: /.=?/g, go: CTp._getOp });
	addTokenizers('|',  { matcher: /.[|=]?/g, go: CTp._getOp });
	addTokenizers('&', { matcher: /&[&=]?/g, go: CTp._getOp });
	addTokenizers('!=', { matcher: /.=?=?/g, go: CTp._getOp });
	addTokenizers(',?:()[]{}', { go: CTp._getOp });
	addTokenizers('/', CTp._getSlash);
})();
