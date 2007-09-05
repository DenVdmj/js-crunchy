Crunchy.write = function(x) {
	var writer = new Crunchy.Writer;
	writer.writeStatement(x);
	return writer.result.join('');
}

Crunchy.Writer = function(x) {
	for(var i in this) this[i] = this[i];
	this.result = [];
}

Crunchy.Writer.prototype = {
	prev : null,
	invalidOp : null,
	statementStart : false,
	ended : true,
	needEnd : false,

	addInvalidOp : function(op, func) {
		var old = this.invalidOp;
		this.invalidOp = op;
		try {
			func.apply(this);
		} finally {
			this.invalidOp = old;
		}
	},

	clearInvalidOps : function(func) {
		var old = this.invalidOp;
		this.invalidOp = null;
		try {
			func.apply(this);
		} finally {
			this.invalidOp = old;
		}
	},

	writeIsIdChar : /^[a-zA-Z0-9_$]$/,

	// TODO: This is dire, I should do it much more intelligently.
	// The statement ending stuff could probably be done better
	// by iterating over the tree, similarly some of the space insertion.
	write : function() {
		if(this.needEnd) {
			if(Crunchy.opTypeNames[arguments[0]]) {
				this.result.push(';'); this.prev = ';';
			}
			else {
				this.result.push('\n'); this.prev = '\n';
			}
			this.needEnd = false;
			this.ended = true;
		}

		this.ended = false;
		this.statementStart = false;

		for(var i = 0; i < arguments.length; ++i) {
			var token = String(arguments[i]);

			if(this.prev) {
				switch(this.prev) {
				case '+':
					if(token.charAt(0) == '+')
						this.result.push(' ');
					break;
				case '-':
					if(token.charAt(0) == '-')
						this.result.push(' ');
					break;
				case '0': case '1': case '2': case '3': case '4':
				case '5': case '6': case '7': case '8': case '9':
					// TODO: I think I only need to do this for integers.
					if(token.charAt(0) == '.')
						this.result.push(' ');
					break;
				default:
					if(this.writeIsIdChar.test(this.prev) &&
						this.writeIsIdChar.test(token.charAt(0)))
						this.result.push(' ');
					break;
				}
			}
			this.result.push(token);
			this.prev = token.charAt(token.length-1);
		}
	},

	endStatement : function() {
		this.ended = true;
	},

	seperateStatement : function() {
		if(!this.ended) {
			if(true) {
				this.write(';');
				this.ended = true;
				this.needEnd = false;
			}
			else {
				// TODO: When is it safe to use a newline? It's tricky - it's
				// often not safe when the next line starts with a
				// pre-increment. Any other cases?
				this.needEnd = true;
			}
		}
	},

	writeStatements : function(statements) {
		for(var i = 0; i < statements.length; ++i) {
			if(i != 0) this.seperateStatement();
			this.writeStatement(statements[i]);
		}
	},

	writeStatement : function(s) {
		if(this.invalidOp == "IF" && s.type == "IF" && !s.elsePart) {
			this.writeBlock([s], true);
			return;
		}

		switch(s.type) {
		case "SCRIPT":
			this.writeStatements(s.body);
			break;
		case "FUNCTION":
			this.writeFunction(s);
			break;
		case "BLOCK":
			// TODO: Strip out blocks when not needed.
			// I think they're only needed when they
			//   a) contain a function
			//   b) are at the top level, or the top level of a function.
			this.writeBlock(s.children, true);
			break;
		case "IF":
			this.write('if');
			this.writeBracketed(s.condition, '(', ')');
			if(s.elsePart) {
				this.addInvalidOp("IF", function() {
					this.writeBlock(s.thenPart, false);
				});
				this.seperateStatement();
				this.write('else');
				this.writeBlock(s.elsePart, false);
			}
			else {
				this.writeBlock(s.thenPart, false);
			}
			break;
		case "SWITCH":
			this.write('switch');
			this.writeBracketed(s.discriminant, '(', ')');
			this.write('{');
			for(var i = 0; i < s.cases.length; ++i) {
				if(i != 0) this.seperateStatement();
				switch(s.cases[i].type) {
				case "CASE":
					this.write('case');
					this.writeExpression(s.cases[i].caseLabel);
					this.write(':');
					this.endStatement();
					break;
				case "DEFAULT":
					this.write('default', ':');
					this.endStatement();
					break;
				default:
					Crunchy.error("Unrecognized switch clause: " +
						strToken(s.cases[i].type));
					break;
				}
				this.writeStatements(s.cases[i].statements);
			}
			this.write('}');
			this.endStatement();
			break;
		case "FOR":
			this.write('for','(');
			if(s.setup) this.addInvalidOp('IN', function() {
				this.writeExpressionOrVar(s.setup);
			});
			this.write(';');
			if(s.condition)this.writeExpression(s.condition);
			this.write(';');
			if(s.update)this.writeExpression(s.update);
			this.write(')');
			this.writeBlock(s.body);
			break;
		case "FOR_IN":
			this.write('for','(');
			this.addInvalidOp('IN', function() {
				this.writeExpressionOrVar(s.iterator);
			});
			this.write('in');
			this.writeExpression(s.object);
			this.write(')');
			this.writeBlock(s.body);
			break;
		case "WHILE":
			this.write('while','(');
			this.writeExpression(s.condition);
			this.write(')');
			this.writeBlock(s.body);
			break;
		case "DO":

			this.write('do');
			// TODO: Curly brackers aren't needed for a do/while block but some
			// javascript implementations think they are.
			this.writeBlock(s.body, true);
			this.seperateStatement();
			this.write('while','(');
			this.writeExpression(s.condition);
			this.write(')');

			// TODO: This is not valid ECMAscript. Basically all Javascript
			// interpreters seem to automatically insert a semi-colon after a
			// do..while (or at least they don't expect one). If this is a
			// problem it would be better to either follow the while with a
			// newline or wrap the do..while in curly brackets.
			// https://bugzilla.mozilla.org/show_bug.cgi?id=238945
			this.endStatement();
			break;
		case "BREAK":
		case "CONTINUE":
		case "GOTO":
			this.write(Crunchy.tokens[s.type]);
			if(s.label) this.write(s.label);
			break;
		case "TRY":
			this.write('try');
			this.writeBlock(s.tryBlock, true);
			for(var i = 0; i < s.catchClauses.length; ++i) {
				this.write('catch','(');
				this.write(s.catchClauses[i].varRef ?
						s.catchClauses[i].varRef.name :
						s.catchClauses[i].varName);
				if(s.catchClauses[i].guard) {
					this.write('if');
					this.writeExpression(s.catchClauses[i].guard);
				}
				this.write(')');
				this.writeBlock(s.catchClauses[i].block, true);
			}
			if(s.finallyBlock) {
				this.write('finally');
				this.writeBlock(s.finallyBlock, true);
			}
			break;
		case "THROW":
			this.write('throw');
			this.writeExpression(s.exception);
			break;
		case "RETURN":
			this.write('return');
			if(s.returnValue) this.writeExpression(s.returnValue);
			break;
		case "WITH":
			this.write('with','(');
			this.writeExpression(s.object);
			this.write(')');
			this.writeBlock(s.body);
			break;
		case "VAR":
		case "CONST":
			this.writeVar(s);
			break;
		case "DEBUGGER":
			this.write('debugger');
			break;
		case "SEMICOLON":
			// Transformation is meant to remove empty semicolons.
			if(!s.expression)
				Crunchy.error("Empty semicolon");
			else {
				this.statementStart = true;
				this.writeExpression(s.expression);
			}
			break;
		case "LABEL":
			this.write(s.label,':');
			this.writeBlock(s.statement);
			break;
		case "DEBUG_SEMICOLON":
			break;
		default:
			Crunchy.error("Unrecognized statement node type: " + Crunchy.tokenstr(s.type));
		}
	},

	writeExpressionOrVar : function(e) {
		return e.type == "VAR" || e.type == "CONST" ? this.writeVar(e) :
			this.writeExpression(e);
	},

	writeBracketed : function(es, open, close) {
		this.clearInvalidOps(function() {
			this.write(open);
			if(es.constructor == Array) {
				for(var i = 0; i < es.length; ++i) {
					if(i != 0) this.write(',');
					// Note: Could just set the precedence to Crunchy.opPrecedence[COMMA] + 1.
					// but I'd have to remeber to do that in OBJECT_INIT etc.
					this.addInvalidOp("COMMA", function() {
						this.writeExpression(es[i]);
					});
				}
				// Arrays that end with an EMPTY need a trailing comma.
				if(es.length && es.top().type == "EMPTY") this.write(',');
			}
			else {
				this.writeExpression(es);
			}
			this.write(close);
		});
	},

	writeExpression : function(e, precedence) {
		precedence = precedence || 0;

		if(this.invalidOp == e.type) {
			this.clearInvalidOps(function() {
				this.writeBracketed(e, '(', ')');
			});
			return;
		}

		var op = Crunchy.tokens[e.type].toLowerCase();
		switch(e.type) {
		case "FUNCTION":
			this.writeFunction(e);
			break;
		case "EMPTY":
			break;
		case "IDENTIFIER":
		case "MEMBER_IDENTIFIER":
			this.write(e.ref ? e.ref.name : e.value);
			break;
		case "NULL": case "THIS": case "TRUE": case "FALSE":
		case "NUMBER": case "REGEXP":
			this.write(e.value);
			break;
		case "STRING":
			//this.write(e.value);
			this.write(Crunchy.stringEscape(e.value));
			break;
		case "CONDITIONAL":
			this.clearInvalidOps(function() {
				if(precedence > Crunchy.opPrecedence["CONDITIONAL"])
					this.write('(');
				this.writeExpression(e.children[0],
						e.children[0].type == "ASSIGN" ? Crunchy.opPrecedence["ASSIGN"]+1 :
						Crunchy.opPrecedence["CONDITIONAL"]);
				this.write('?');
				this.writeExpression(e.children[1], Crunchy.opPrecedence["CONDITIONAL"]);
				this.write(':');
				this.writeExpression(e.children[2], Crunchy.opPrecedence["CONDITIONAL"]);
				if(precedence > Crunchy.opPrecedence["CONDITIONAL"])
					this.write(')');
			});
			break;
		case "NEW_WITH_ARGS":
		case "CALL":
			// Nothing binds closer, so brackets aren't required here.
			// I suppose if DOT could use expressions for the member
			// eg. x.(y()). But it doesn't, that's meaningless.
			if(e.type == "NEW_WITH_ARGS")
				for(var i = 1; i < e.children.length; ++i) this.write('new');

			this.writeExpression(e.children[0], Crunchy.opPrecedence["DOT"]);
			for(var i = 1; i < e.children.length; ++i) {
				if(e.children[i].type != "LIST") {
					Crunchy.error("Suprise operand type for CALL.");
					this.writeBracketed([], '(', ')');
				}
				else {
					this.writeBracketed(e.children[i].children, '(', ')');
				}
			}
			break;
		case "INDEX":
			// INDEX binds as for CALL
			this.writeExpression(e.children[0], Crunchy.opPrecedence["DOT"]);
			for(var i = 1; i < e.children.length; ++i)
				this.writeBracketed(e.children[i], '[', ']');
			break;
		case "OBJECT_INIT":
			this.writeBracketed(e.children, '{', '}');
			// TODO: A semi-colon is required after an object that ends a statement.
			break;
		case "PROPERTY_INIT": // TODO: Is this an expression?
			if(e.children[0].type == "STRING" &&
				/^[a-zA-Z$_][a-zA-Z0-9$_]*$/.test(e.children[0].value) &&
				!Crunchy.lookupKeyword(e.children[0].value))
			{
				this.write(e.children[0].value);
			}
			else
			{
				this.writeExpression(e.children[0]);
			}
			this.write(':');
			// (this works for commas because invalidOp has been set - tenuous?)
			this.writeExpression(e.children[1]);
			break;
		case "ARRAY_INIT":
			this.writeBracketed(e.children, '[', ']');
			// TODO: A semi-colon is required after an object that ends a statement.
			break;
		case "ASSIGN":
			if(e.children[0].assignOp)
				op = Crunchy.tokens[e.children[0].assignOp] + op;
			// TODO: How to deal with equal precedence?
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write('(');
			this.writeExpression(e.children[0], Crunchy.opPrecedence[e.type] + 1);
			for(var i = 1; i < e.children.length; ++i) {
				this.write(op);
				this.writeExpression(e.children[1], Crunchy.opPrecedence[e.type]);
			}
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write(')');
			break;
		case "COMMA": case "OR": case "AND":
		case "BITWISE_OR": case "BITWISE_XOR": case "BITWISE_AND":
		case "EQ": case "NE": case "STRICT_EQ": case "STRICT_NE":
		case "LT": case "LE": case "GE": case "GT":
		case "IN": case "INSTANCEOF":
		case "LSH": case "RSH": case "URSH":
		case "PLUS": case "MINUS": case "MUL": case "DIV": case "MOD":
		case "DOT":
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write('(');
			this.writeExpression(e.children[0], Crunchy.opPrecedence[e.type]);
			for(var i = 1; i < e.children.length; ++i) {
				this.write(op);
				this.writeExpression(e.children[i], Crunchy.opPrecedence[e.type] + 1);
			}
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write(')');
			break;
		case "INCREMENT": case "DECREMENT":
			// The only operators that bind tighter are CALL/NEW/DOT
			// which should never take the result of these operators,
			// but just in case.... 
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write('(')
			if(!e.postfix)this.write(op);
			// TODO: Precedence...
			this.writeExpression(e.children[0], Crunchy.opPrecedence[e.type]);
			if(e.postfix)this.write(op);
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write(')');
			break;
		case "UNARY_PLUS":
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write('(')
			this.write('+');
			this.writeExpression(e.children[0], Crunchy.opPrecedence[e.type]);
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write(')');
			break;
		case "UNARY_MINUS":
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write('(')
			this.write('-');
			this.writeExpression(e.children[0], Crunchy.opPrecedence[e.type]);
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write(')');
			break;
		case "NEW": case "DELETE": case "VOID": case "TYPEOF":
		case "NOT": case "BITWISE_NOT":
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write('(');
			// I think there's no need to group prefix operators.
			this.write(op);
			// TODO: Precedence...
			this.writeExpression(e.children[0], Crunchy.opPrecedence[e.type]);
			if(precedence > Crunchy.opPrecedence[e.type])
				this.write(')');
			break;
		default:
			Crunchy.error("Unrecognized expression node type: " + Crunchy.tokenstr(e.type));
		}
	},

	writeFunction : function(node) {
		var needBrackets = node.functionForm == Crunchy.EXPRESSED_FORM &&
			(this.needEnd || this.statementStart);
		if(needBrackets) this.write('(');
		this.write('function');
		if(node.name2) this.write(node.name2.name);
		this.write('(');
		for(var i = 0; i < node.params2.length; ++i) {
			if(i != 0) this.write(',');
			this.write(node.params2[i].name);
		}
		this.write(')');
		this.write('{');
		this.writeStatements(node.body);
		this.write('}');
		if(needBrackets) this.write(')');

		this.ended = node.functionForm != Crunchy.EXPRESSED_FORM;
	},

	writeVar : function(v) {
		this.write(v.type == "VAR" ? 'var' : 'const');
		for(var i = 0; i < v.children.length; ++i) {
			if(i!=0) this.write(',');
			var x = v.children[i];
			this.writeExpression(x, Crunchy.opPrecedence["ASSIGN"]+1);
			if(x.initializer) {
				this.write('=');
				this.writeExpression(x.initializer, Crunchy.opPrecedence["ASSIGN"]);
			}
		}
	},

	writeBlock : function(statements, curliesRequired) {
		if(statements.length == 0) {
			if(curliesRequired) {
				this.write('{}');
				this.endStatement();
			}
			else {
				// The standard(7.9.1) sez:
				//
				// 'However, there is an additional overriding condition on the
				// preceding rules: a semicolon is never inserted automatically if
				// the semicolon would then be parsed as an empty statement'
				//
				// so a semicolon is required for empty statements.

				this.write(';');
				this.endStatement();
			}
		}
		else {
			if(curliesRequired || statements.length > 1) {
				// clearInvalidOps
				// TODO: Why not in the other paths?
				var old = this.invalidOp;
				this.invalidOp = null;

				this.write('{');
				this.writeStatements(statements);
				this.write('}');
				this.endStatement();

				this.invalidOp = old;
			}
			else {
				this.writeStatements(statements);
			}
		}
	}
}

;(function() {
	var translate = {
		"\\" : "\\\\",
		"\x08" : "\\b",
		"\x09" : "\\t",
		"\x0a" : "\\n",
		"\x0b" : "\\v",
		"\x0c" : "\\f",
		"\x0d" : "\\r"
	}

	var translateRegExp = /[\\\x08\x09\x0a\x0b\x0c\x0d]/g;

	Crunchy.stringEscape = function(text) {
		text = text.replace(translateRegExp, function(x) {
			return translate[x] || x;
		});

		var singleQuotes = text.match(/'/g), doubleQuotes = text.match(/"/g);
		if(doubleQuotes && (!singleQuotes || singleQuotes.length < doubleQuotes.length)) {
			return("'" + text.replace(/'/g, "\\'") + "'");
		}
		else {
			return('"' + text.replace(/"/g, '\\"') + '"');
		}
	}
})();
