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

(function() {

function CompilerContext(inFunction) {
	this.inFunction = inFunction;
	this.nestedLevel = 0;
	this.funDecls = [];
	this.varDecls = [];
}

var CCp = CompilerContext.prototype;
CCp.bracketLevel = CCp.curlyLevel = CCp.parenLevel = CCp.hookLevel = 0;
CCp.inForLoopInit = false;

// TODO: Either pull this out of the prototype or delete it.
CCp.ecmaStrictMode = false;

var NodeTypes = {
	SCRIPT : [ "body" ], // also: funDecls, varDecls
	IF : [ "condition", "thenPart", "elsePart" ],
	SWITCH : [ "discriminant", "cases" ], // also: defaultIndex
	CASE : [ "caseLabel", "statements" ],
	DEFAULT : [ "statements" ],
	FOR : [ "setup", "condition", "update", "body" ], // also: isLoop = true
	FOR_IN : [ "iterator", "object", "body" ], // also: isLoop = true (this is wrong, iterator is included in varDecl when varDecl is present).
	WHILE : [ "condition", "body" ], // also: isLoop = true
	DO : [ "body", "condition" ], // also: isLoop = true
	BREAK : [], // also: label
	CONTINUE : [], // also: label
	TRY : [ "tryBlock", "catchClauses", "finallyBlock" ],
	CATCH : [ "guard", "block" ], // also: node.varName
	THROW : [ "exception" ],
	RETURN : [ "returnValue" ],
	WITH : [ "object", "body" ],
	DEBUGGER : [],
	LABEL : [ "statement" ], // also: label 
	SEMICOLON : [ "expression" ],
	DEBUG_SEMICOLON : [ "statement" ],
	FUNCTION : [ "body" ], // also: name, params, functionForm, funDecls, varDecls
	VAR : [  ], // operands?
	CONST : [  ], // operands?
	IDENTIFIER : ["initializer"], // also name, readOnly
	
	// Extensions:
	GOTO : [],
	GETTER : [ "body" ], // also: name, params, functionForm, funDecls, varDecls
	SETTER : [ "body" ]  // also: name, params, functionForm, funDecls, varDecls
}

//function addSetter(object, name, index) {
//	  return function(n) {
//		  this[name] = n;
//		  this.children[index] = n;
//	  }
//}

function getNodeType(info) {
	var result = {};

	for(var i=0; i<info.length; ++i) {
		var name = info[i];

		//result["set" + name[0].toUpperCase() + name.substr(1)]
		//	  = addSetter(result, name, i);

		eval("result.set" + name.charAt(0).toUpperCase() + name.substr(1) +
				" = function(n) { " +
				"this." + name + " = n;" +
				"this.children[" + i + "] = n" +
			"}");
	}

	return result;
}

for(var i in NodeTypes) NodeTypes[i] = getNodeType(NodeTypes[i]);

function Node(t, type) {
	var token = t.token();
	if (token) {
		this.type = typeof(type) == "string" ? type : token.type;
		this.value = token.value;
	} else {
		this.type = type;
	}
	this.tokenizer = t;
	this.children = [];

	var info = NodeTypes[this.type];
	if(this.type && info) {
		for(var i in info) this[i] = info[i];
	}
}

var Np = Node.prototype;

Np.setType = function(type) {
	if(this.type) throw "Type already set";

	var info = NodeTypes[type];
	if(info) {
		for(var i in info) this[i] = info[i];
	}
	this.type = type;
}

var OperatorNode = Node;

Np.pushOperand = function (kid) {
	return this.children.push(kid);
}

Np.forChildren = function(f) {
	for(var i = 0; i < this.children.length; ++i) {
		var child = this.children[i];
		if(child) {
			if(child.constructor == Array) {
				for(var j = 0; j < child.length; ++j) {
					f(child[j]);
				}
			}
			else {
				f(child);
			}
		}
	}
}

Node.indentLevel = 0;

function tokenstr(tt) {
	var t = Crunchy.tokens[tt];
	return t ? (/^\W/.test(t) ? Crunchy.opTypeNames[t] : t.toUpperCase()) : "(null)";
}

Np.toString = function () {
	var a = [];
	for (var i in this) {
		if (this.hasOwnProperty(i) && i != 'type')
			a.push({id: i, value: this[i]});
	}
	a.sort(function (a,b) { return (a.id > b.id) - (a.id < b.id); });
	var INDENTATION = "    ";
	var n = ++Node.indentLevel;
	var s = "{\n" + INDENTATION.repeat(n) + "type: " + tokenstr(this.type);
	for (i = 0; i < a.length; i++)
		s += ",\n" + INDENTATION.repeat(n) + a[i].id + ": " + a[i].value;
	n = --Node.indentLevel;
	s += "\n" + INDENTATION.repeat(n) + "}";
	return s;
}

Np.filename = function () { return this.tokenizer.filename; };

Crunchy.DECLARED_FORM = 0;
Crunchy.EXPRESSED_FORM = 1;
Crunchy.STATEMENT_FORM = 2;

Crunchy.Parser = function() {
}

Crunchy.Parser.prototype = {
	parse: function(s, f, l) {
		var t = new Crunchy.Tokenizer(s, f, l);
		var n = this.Script(t);
		if (t.peekOperand().type != "END")
			throw t.newSyntaxError("Syntax error");
		return n;
	},

	Script: function(t) {
		var n = new Node(t, "SCRIPT");
		n.setBody(this.ParseCompilerContext(t, n, false));
		return n;
	},

	ParseCompilerContext: function(t, n, inFunction) {
		var x = new CompilerContext(inFunction);
		var nodes = this.Statements(t, x);
		n.funDecls = x.funDecls;
		n.varDecls = x.varDecls;
		return nodes;
	},

	Statements: function(t, x) {
		var tt,nodes = [];
		while ((tt = t.peekOperand().type) != "END" && tt != "RIGHT_CURLY")
			nodes = nodes.concat(this.Statement(t, x));
		return nodes;
	},

	Block: function(t, x) {
		if(t.peekOperand().type != "LEFT_CURLY")
			throw t.newSyntaxError("Code block expected.");
		return this.OptionalBlock(t, x);
	},

	OptionalBlock: function(t, x) {
		++x.nestedLevel;
		var s = this.Statement(t, x);
		--x.nestedLevel;
		return s;
	},

	Statement: function(t, x) {
		// TODO: Here we might have previously called 'peekOperator', and
		// auto-inserted a semi-colon.
		return (this.StatementMethods[t.getOperand()] || this.StatementMethods['default']).call(this, t, x);
	},

	StatementMethods: {
		"FUNCTION" : function(t, x) {
			return [this.FunctionDefinition(t, x, true,
					x.nestedLevel > 0 ? Crunchy.STATEMENT_FORM : Crunchy.DECLARED_FORM)];

		},

		"LEFT_CURLY" : function(t, x) {
			++x.nestedLevel;
			var children = this.Statements(t, x);
			--x.nestedLevel;
			t.mustMatchOperator("RIGHT_CURLY");
			if(x.nestedLevel == 0) {
				var n = new Node(t, "BLOCK");
				n.children = children;
				return [n];
			}
			else {
				return children;
			}
		},

		"IF" : function(t, x) {
			var n = new Node(t, "IF");
			n.setCondition(this.ParenExpression(t, x));
			n.setThenPart(this.OptionalBlock(t, x));
			n.setElsePart(t.matchOperator("ELSE") ? this.OptionalBlock(t, x) : null);
			return [n];
		},

		"SWITCH" : function(t, x) {
			var tt;
			var n = new Node(t);

			t.mustMatchOperator("LEFT_PAREN");
			n.setDiscriminant(this.Expression(t, x));
			t.mustMatchOperator("RIGHT_PAREN");

			var cases = [];
			t.mustMatchOperand("LEFT_CURLY");
			++x.nestedLevel;
			while ((tt = t.getOperand()) != "RIGHT_CURLY") {			
				var n2 = new Node(t);
				if(tt == "CASE") {
					n2.setCaseLabel(this.Expression(t, x, "COLON"));
				}
				else if(tt != "DEFAULT") {
					throw t.newSyntaxError("Invalid switch case");
				}
				t.mustMatchOperand("COLON");
				var statements = [];
				while ((tt=t.peekOperand().type) != "CASE" && tt != "DEFAULT" && tt != "RIGHT_CURLY")
					statements = statements.concat(this.Statement(t, x));
				n2.setStatements(statements);
				cases.push(n2);
			}
			--x.nestedLevel;
			n.setCases(cases);

			return [n];
		},

		"FOR" : function(t, x) {
			var n = new Node(t, "");
			n.isLoop = true;
			t.mustMatchOperator("LEFT_PAREN");

			var tt, n2;
			if ((tt = t.peekOperand().type) != "SEMICOLON") {
				x.inForLoopInit = true;
				if (tt == "VAR" || tt == "CONST") {
					t.getOperand();
					n2 = this.Variables(t, x);
				} else {
					n2 = this.Expression(t, x);
				}
				x.inForLoopInit = false;
			}

			// TODO: I'm not sure about this...
			// Really it shouldn't matter if I say Operator or Operand
			// but operator seems to be appropriate here - even though it
			// used to Operand.
			if (n2 && t.matchOperator("IN")) {
				n.setType("FOR_IN");
				n.isLoop = true;
				if (n2.type == "VAR" && n2.children.length != 1) {
					throw t.newSyntaxError("Invalid for..in left-hand side");
				}

				n.setIterator(n2);
				n.setObject(this.Expression(t, x));
			} else {
				n.setType("FOR");
				n.setSetup(n2 || null);
				t.mustMatchOperator("SEMICOLON");
				n.setCondition((t.peekOperand().type == "SEMICOLON") ? null : this.Expression(t, x));
				t.mustMatchOperator("SEMICOLON");
				n.setUpdate((t.peekOperand().type == "RIGHT_PAREN") ? null : this.Expression(t, x));
			}
			t.mustMatchOperator("RIGHT_PAREN");
			n.setBody(this.OptionalBlock(t, x));
			return [n];
		},

		"WHILE" : function(t, x) {
			var n = new Node(t);
			n.isLoop = true;
			n.setCondition(this.ParenExpression(t, x));
			n.setBody(this.OptionalBlock(t, x));
			return [n];

		},

		"DO" : function(t, x) {
			var n = new Node(t);
			n.isLoop = true;
			// TODO: I forget if the block really is optional.
			n.setBody(this.OptionalBlock(t, x));
			t.mustMatchOperand("WHILE");
			n.setCondition(this.ParenExpression(t, x));

			// Several javascript implementations allow automatic semicolon
			// insertion without a newline after do-while.
			// See http://bugzilla.mozilla.org/show_bug.cgi?id=238945.
			if (x.ecmaStrictMode) this.StatementEnd(t,x); 
			else t.matchOperand("SEMICOLON");
			return [n];

		},

		"BREAK" : function(t, x) {
			// TODO: Duplicat of CONTINUE....
			var n = new Node(t);
			if (t.peekOnSameLine().isProperty) {
				t.getOperand();
				n.label = t.token().value;
			}
			this.StatementEnd(t,x);
			return [n];
		},

		"CONTINUE" : function(t, x) {
			var n = new Node(t);
			if (t.peekOnSameLine().isProperty) {
				t.getOperand();
				n.label = t.token().value;
			}
			this.StatementEnd(t,x);
			return [n];
		},

		"TRY" : function(t, x) {
			var n = new Node(t);
			n.setTryBlock(this.Block(t, x));
			var catchClauses = [];
			while (t.matchOperand("CATCH")) {
				var n2 = new Node(t);
				t.mustMatchOperator("LEFT_PAREN");
				// TODO: isProperty
				n2.varName = t.mustMatchOperand("IDENTIFIER").value;
				if (t.matchOperand("IF")) {
					if (x.ecmaStrictMode)
						throw t.newSyntaxError("Illegal catch guard");
					if (catchClauses.length && !catchClauses.top().guard)
						throw t.newSyntaxError("Guarded catch after unguarded");
					n2.setGuard(this.Expression(t, x));
				} else {
					n2.setGuard(null);
				}
				t.mustMatchOperator("RIGHT_PAREN");
				n2.setBlock(this.Block(t, x));
				catchClauses.push(n2);
			}
			n.setCatchClauses(catchClauses);
			if (t.matchOperand("FINALLY"))
				n.setFinallyBlock(Block(t, x));
			if (!n.catchClauses.length && !n.finallyBlock)
				throw t.newSyntaxError("Invalid try statement");
			return [n];

		},

		"CATCH" : function(t, x) {
			// TODO: Duplicate of FINALLY
			throw t.newSyntaxError("catch without preceding try");
		},

		"FINALLY" : function(t, x) {
			throw t.newSyntaxError("finally without preceding try");
		},

		"THROW" : function(t, x) {
			var n = new Node(t);
			n.setException(this.Expression(t, x));
			this.StatementEnd(t,x);
			return [n];
		},

		"RETURN" : function(t, x) {
			if (!x.inFunction)
				throw t.newSyntaxError("Invalid return");
			var n = new Node(t);
			var tt = t.peekOnSameLine().type;
			if (tt != "END" && tt != "NEWLINE" && tt != "SEMICOLON" && tt != "DEBUG_SEMICOLON" && tt != "RIGHT_CURLY")
				n.setReturnValue(this.Expression(t, x));
			this.StatementEnd(t,x);
			return [n];
		},

		"WITH" : function(t, x) {
			var n = new Node(t);
			n.setObject(this.ParenExpression(t, x));
			// TODO: I forget if with statement requires curlies.
			n.setBody(this.OptionalBlock(t, x));
			return [n];

		},

		"VAR" : function(t, x) {
			var n = this.Variables(t, x);
			this.StatementEnd(t,x);
			return [n];
		},

		"CONST" : function(t, x) {
			var n = this.Variables(t, x);
			this.StatementEnd(t,x);
			return [n];
		},

		"DEBUGGER" : function(t, x) {
			var n = new Node(t);
			this.StatementEnd(t,x);
			return [n];
		},
		
		"NEWLINE" : function(t, x) {
			return [];
		},

		"SEMICOLON" : function(t, x) {
			return [];
		},

		"DEBUG_SEMICOLON" : function(t, x) {
			var n = new Node(t);
			n.setStatement(this.Statement(t, x));
			return [n];
		},

		"default": function(t, x) {
			if (t.token().isProperty && t.peekOperator().type == "COLON")
			{
				var label = t.token().value;
				t.getOperand();
				var n = new Node(t, "LABEL");
				n.label = label;
				n.setStatement(this.Statement(t, x));
				return [n];
			}
			else {
				var n = new Node(t, "SEMICOLON");
				t.unget();
				n.setExpression(this.Expression(t, x));
				this.StatementEnd(t,x);
				return [n];
			}
		},

		// Extensions:
		
		"GOTO": function(t, x) {
			// TODO: Peek for operators not operands. Why? If goto is the first token in an expression, the next is an operator. If goto is the first token
			// in a goto statement, the next token is a label - which will be correctly identified by a peek operator call.
			var tt = t.peekOnSameLine();

			if(tt.isProperty) {
				// TODO: Duplicate of BREAK/CONTINUE (sort of).
				var n = new Node(t);
				t.getOperand();
				n.label = t.token().value;
				this.StatementEnd(t,x);
				return [n];
			}
			else {
				return this.StatementMethods['default'].call(this,t, x);
			}
		}
	},

	StatementEnd: function(t, x) {
		if (t.lineno == t.token().lineno) {
			tt = t.peekOnSameLine().type;
			if (tt != "END" && tt != "NEWLINE" && tt != "SEMICOLON" && tt != "DEBUG_SEMICOLON" && tt != "RIGHT_CURLY")
				throw t.newSyntaxError("Missing ; before statement");
		}
		t.matchOperand("SEMICOLON");
	},

	FunctionDefinition: function(t, x, requireName, functionForm) {
		var token = t.token();

		if(token.type == "FUNCTION") var type = "FUNCTION";
		else if(token.value == "get") var type = "GETTER";
		else if(token.value == "set") var type = "SETTER";
		else throw("Invalid function.")

		var f = new Node(t, type);

		// TODO: isProperty
		if (t.matchOperand("IDENTIFIER"))
			f.name = t.token().value;
		else if (requireName)
			throw t.newSyntaxError("Missing function identifier");

		t.mustMatchOperator("LEFT_PAREN");
		var params = [];
		var tt;
		// TODO: This will match function(x,) {}
		while ((tt = t.getOperand()) != "RIGHT_PAREN") {
			// TODO: isProperty
			if (tt != "IDENTIFIER")
				throw t.newSyntaxError("Missing formal parameter");
			params.push(t.token().value);
			// TODO: Operator/Operand? Either, but operator seems to make more
			// sence
			if (t.peekOperator().type != "RIGHT_PAREN")
				t.mustMatchOperator("COMMA");
		}
		f.params = params;

		t.mustMatchOperator("LEFT_CURLY");
		f.setBody(this.ParseCompilerContext(t, f, true));
		t.mustMatchOperand("RIGHT_CURLY");

		f.functionForm = functionForm;

		// If functionForm == Crunchy.STATEMENT_FORM then we have something like:
		//
		// if(true) { function foo(); }
		//
		// On some implementations foo is only added to the declarations when
		// it has been executed. So it could possibly be added in a 'might match'
		// style. But for now it makes sense to say that it's the same variable as
		// any in the enclosing blocks.

		if (functionForm == Crunchy.DECLARED_FORM)
			x.funDecls.push(f);
		return f;
	},

	Variables: function(t, x) {
		var n = new OperatorNode(t);
		do {
			// TODO: isProperty
			t.mustMatchOperand("IDENTIFIER");
			var n2 = new Node(t);
			n2.name = n2.value;
			if (t.matchOperator("ASSIGN")) {
				if (t.token().assignOp)
					throw t.newSyntaxError("Invalid variable initialization");
				n2.setInitializer(this.Expression(t, x, "COMMA"));
			}
			n2.readOnly = (n.type == "CONST");
			n.pushOperand(n2);
			x.varDecls.push(n2);
		} while (t.matchOperator("COMMA"));
		return n;
	},

	ParenExpression: function(t, x) {
		t.mustMatchOperator("LEFT_PAREN");
		var n = this.Expression(t, x);
		t.mustMatchOperator("RIGHT_PAREN");
		return n;
	},

	Expression: function(t, x, stop) {
		var tt, operators = [], operands = [];
		var state = { bl : x.bracketLevel, cl : x.curlyLevel, pl : x.parenLevel, hl : x.hookLevel, scanOperand : true };

		do {
			// NOTE: If tt == END, a method won't be found and the loop will exit
			// normally.
			tt = t.getToken(state.scanOperand);

			// Stop if tt matches the optional stop parameter, and that
			// token is not quoted by some kind of bracket.
			if (tt == stop &&
				x.bracketLevel == state.bl && x.curlyLevel == state.cl && x.parenLevel == state.pl &&
				x.hookLevel == state.hl) {
				break;
			}

			var f = (state.scanOperand ? this.OperandMethods : this.OperatorMethods)[tt];
		} while(f && f.call(this, t, x, tt, state, operators, operands));

		if (x.hookLevel != state.hl)
			throw t.newSyntaxError("Missing : after ?");
		if (x.parenLevel != state.pl)
			throw t.newSyntaxError("Missing ) in parenthetical");
		if (x.bracketLevel != state.bl)
			throw t.newSyntaxError("Missing ] in index expression");
		if (state.scanOperand)
			throw t.newSyntaxError("Missing operand");

		// Resume default mode, scanning for operands, not operators.
		t.unget();
		while (operators.length)
			this.ReduceExpression(t, operators, operands);
		return operands.pop();
	},

	// Operator Methods

	ExpressionUnaryOperator: function(t, x, tt, state, operators, operands) {
		if(tt == 'PLUS' || tt == 'MINUS') tt = 'UNARY_' + tt;
		operators.push(new OperatorNode(t, tt));
		return true;
	},

	ExpressionFunction: function(t, x, tt, state, operators, operands) {
		operands.push(this.FunctionDefinition(t, x, false, Crunchy.EXPRESSED_FORM));
		state.scanOperand = false;
		return true;
	},

	ExpressionOperand: function(t, x, tt, state, operators, operands) {
		var n = new Node(t);
		if(n.type == "IDENTIFIER")
			n.name = n.value;
		operands.push(n);
		state.scanOperand = false;
		return true;
	},

	ExpressionArrayInit: function(t, x, tt, state, operators, operands) {
		// Array initialiser.  Parse using recursive descent, as the
		// sub-grammar here is not an operator grammar.
		var n = new OperatorNode(t, "ARRAY_INIT");
		while ((tt = t.peekOperand().type) != "RIGHT_BRACKET") {
			if (tt == "COMMA") {
				t.getOperand();
				n.pushOperand(new Node(t, "EMPTY"));
				continue;
			}
			n.pushOperand(this.Expression(t, x, "COMMA"));
			if (!t.matchOperator("COMMA"))
				break;
		}
		t.mustMatchOperator("RIGHT_BRACKET");
		operands.push(n);
		state.scanOperand = false;
		return true;
	},

	ExpressionLeftCurly: function(t, x, tt, state, operators, operands) {
		// Object initialiser.	As for array initialisers (see above),
		// parse using recursive descent.
		++x.curlyLevel;
		var n = new OperatorNode(t, "OBJECT_INIT");
	  objectInit:
		if (!t.matchOperand("RIGHT_CURLY")) {
			do {
				tt = t.getOperand();
				if ((t.token().value == "get" || t.token().value == "set") &&
					t.peekOperand().type == "IDENTIFIER") {
					if (x.ecmaStrictMode)
						throw t.newSyntaxError("Illegal property accessor");
					n.pushOperand(this.FunctionDefinition(t, x, true, Crunchy.EXPRESSED_FORM));
				} else {
					// TODO: isProperty (or all keywords?)
					switch (tt) {
					  case "IDENTIFIER":
						var id = new Node(t, "MEMBER_IDENTIFIER");
						break;
					  case "NUMBER":
					  case "STRING":
						var id = new Node(t);
						break;
					  case "RIGHT_CURLY":
						if (x.ecmaStrictMode)
							throw t.newSyntaxError("Illegal trailing ,");
						break objectInit;
					  default:
						throw t.newSyntaxError("Invalid property name");
					}
					t.mustMatchOperator("COLON");
					var n2 = new OperatorNode(t, "PROPERTY_INIT");
					n2.pushOperand(id);
					n2.pushOperand(this.Expression(t, x, "COMMA"));
					n.pushOperand(n2);
				}
			} while (t.matchOperand("COMMA"));
			t.mustMatchOperand("RIGHT_CURLY");
		}
		operands.push(n);
		state.scanOperand = false;
		--x.curlyLevel;
		return true;
	},

	ExpressionRightCurly: function(t, x, tt, state, operators, operands) {
		if (x.curlyLevel != state.cl) throw "PANIC: right curly botch";
		return false;
	},

	ExpressionGroup: function(t, x, tt, state, operators, operands) {
		operators.push(new OperatorNode(t, "GROUP"));
		++x.parenLevel;
		return true;
	},

	// Operator Methods

	ExpressionRightAssociative: function(t, x, tt, state, operators, operands) {
		// Use >, not >=, for right-associative operators.
		while (operators.length && Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence[tt])
			this.ReduceExpression(t, operators, operands);

		operators.push(new OperatorNode(t));
		if (tt == "ASSIGN")
			operands.top().assignOp = t.token().assignOp;
		else
			++x.hookLevel;		// tt == HOOK

		state.scanOperand = true;
		return true;
	},

	ExpressionColon: function(t, x, tt, state, operators, operands) {
		// Use >, not >=, for right-associative operators.
		while (operators.length && (Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence[tt] ||
			operators.top().type == "CONDITIONAL" || operators.top().type == "ASSIGN"))
			this.ReduceExpression(t, operators, operands);

		var n = operators.top();
		if (!n || n.type != "HOOK")
			throw t.newSyntaxError("Invalid label");
		n.type = "CONDITIONAL";
		--x.hookLevel;

		state.scanOperand = true;
		return true;
	},

	ExpressionBinaryOperator: function(t, x, tt, state, operators, operands) {
		// An in operator should not be parsed if we're parsing the head of
		// a for (...) loop, unless it is in the then part of a conditional
		// expression, or parenthesized somehow.
		if(tt == "IN" && (x.inForLoopInit && !x.hookLevel &&
			!x.bracketLevel && !x.curlyLevel && !x.parenLevel))
				return false;

		while (operators.length && Crunchy.opPrecedence[operators.top().type] >= Crunchy.opPrecedence[tt])
			this.ReduceExpression(t, operators, operands);
		if (tt == "DOT") {
			var n = new OperatorNode(t, "DOT");
			n.pushOperand(operands.pop());
			// TODO: isProperty
			t.mustMatchOperand("IDENTIFIER");
			n.pushOperand(new Node(t, "MEMBER_IDENTIFIER"));
			operands.push(n);
		} else {
			operators.push(new OperatorNode(t));
			state.scanOperand = true;
		}
		return true;
	},

	ExpressionPostOperator: function(t, x, tt, state, operators, operands) {
		// Use >, not >=, so postfix has higher precedence than prefix.
		while (operators.length && Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence[tt])
			this.ReduceExpression(t, operators, operands);
		var n = new OperatorNode(t, tt);
		n.pushOperand(operands.pop());
		n.postfix = true;
		operands.push(n);
		return true;
	},

	ExpressionIndex: function(t, x, tt, state, operators, operands) {
		// Property indexing operator.
		operators.push(new OperatorNode(t, "INDEX"));
		state.scanOperand = true;
		++x.bracketLevel;
		return true;
	},

	ExpressionRightBracket: function(t, x, tt, state, operators, operands) {
		if (x.bracketLevel == state.bl) return false;
		while (this.ReduceExpression(t, operators, operands).type != "INDEX")
			continue;
		--x.bracketLevel;
		return true;
	},

	ExpressionCall: function(t, x, tt, state, operators, operands) {
		while (operators.length && Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence["NEW"])
			this.ReduceExpression(t, operators, operands);

		// Handle () now, to regularize the n-ary case for n > 0.
		// We must set scanOperand in case there are arguments and
		// the first one is a regexp or unary+/-.
		var n = operators.top();
		state.scanOperand = true;
		if (t.matchOperand("RIGHT_PAREN")) {
			if (n && n.type == "NEW") {
				--operators.length;
				n.pushOperand(operands.pop());
			} else {
				n = new OperatorNode(t, "CALL");
				n.pushOperand(operands.pop());
				n.pushOperand(new OperatorNode(t, "LIST"));
			}
			operands.push(n);
			state.scanOperand = false;
			return true;
		}
		if (n && n.type == "NEW")
			n.type = "NEW_WITH_ARGS";
		else
			operators.push(new OperatorNode(t, "CALL"));

		++x.parenLevel;
		return true;
	},

	ExpressionRightParen: function(t, x, tt, state, operators, operands) {
		if (x.parenLevel == state.pl) return false;
		while ((tt = this.ReduceExpression(t, operators, operands).type) != "GROUP" && tt != "CALL" &&
			   tt != "NEW_WITH_ARGS") {
			continue;
		}
		if (tt != "GROUP") {
			var n = operands.top();
			var last = n.children.length - 1;
			var n2 = n.children[last];
			if (n2.type != "COMMA") {
				n.children[last] = new OperatorNode(t, "LIST");
				n.children[last].pushOperand(n2);
			} else
				n.children[last].type = "LIST";
		}
		else {
			var n = operands.top();
			if(n.type != "GROUP") throw "Expecting GROUP.";
			if(n.children.length != 1) throw "Expecting GROUP with one child.";
			operands[operands.length - 1] = n.children[0];
		}
		--x.parenLevel;
		return true;
	},

	ReduceExpression: function(t, operators, operands) {
		var n = operators.pop();
		var op = n.type;
		var arity = Crunchy.opArity[op];
		var origArity = arity;

		if (arity == -2) {
			// Flatten left-associative trees.
			var left = operands.length >= 2 && operands[operands.length-2];
			if (left.type == op) {
				var right = operands.pop();
				left.pushOperand(right);
				return left;
			}
			arity = 2;
		}

		// Always use push to add operands to n, to update start and end.
		// Workaround: Konqueror requires two arguments to splice (or maybe the
		// one argument form is a seamonkey extension?)
		var a = operands.splice(operands.length - arity, arity);

		// Flatten right-associative trees.
		if(origArity == 2 && a[0].type == op) {
			n = a[0];
			n.pushOperand(a[1]);
		}
		else {
			for (var i = 0; i < arity; i++)
				n.pushOperand(a[i]);
		}

		operands.push(n);
		return n;
	}
};

(function() {

var cpp = Crunchy.Parser.prototype;

cpp.OperandMethods = {
	"PLUS": cpp.ExpressionUnaryOperator,
	"MINUS": cpp.ExpressionUnaryOperator,
	"DELETE": cpp.ExpressionUnaryOperator,
	"VOID": cpp.ExpressionUnaryOperator,
	"TYPEOF": cpp.ExpressionUnaryOperator,
	"NOT": cpp.ExpressionUnaryOperator,
	"BITWISE_NOT": cpp.ExpressionUnaryOperator,
	"NEW": cpp.ExpressionUnaryOperator,
	"INCREMENT": cpp.ExpressionUnaryOperator,
	"DECREMENT": cpp.ExpressionUnaryOperator,
	"FUNCTION": cpp.ExpressionFunction,
	"NULL": cpp.ExpressionOperand,
	"THIS": cpp.ExpressionOperand,
	"TRUE": cpp.ExpressionOperand,
	"FALSE": cpp.ExpressionOperand,
	"IDENTIFIER": cpp.ExpressionOperand,
	"NUMBER": cpp.ExpressionOperand,
	"STRING": cpp.ExpressionOperand,
	"REGEXP": cpp.ExpressionOperand,
	"LEFT_BRACKET": cpp.ExpressionArrayInit,
	"LEFT_CURLY": cpp.ExpressionLeftCurly,
	"RIGHT_CURLY": cpp.ExpressionRightCurly,
	"LEFT_PAREN": cpp.ExpressionGroup
}

cpp.OperatorMethods = {
	"ASSIGN": cpp.ExpressionRightAssociative,
	"HOOK": cpp.ExpressionRightAssociative,
	"COLON": cpp.ExpressionColon,
	"IN": cpp.ExpressionBinaryOperator,
	// Treat comma as left-associative so reduce can fold left-heavy
	// COMMA trees into a single array.
	// FALL THROUGH
	"COMMA": cpp.ExpressionBinaryOperator,
	"OR": cpp.ExpressionBinaryOperator,
	"AND": cpp.ExpressionBinaryOperator,
	"BITWISE_OR": cpp.ExpressionBinaryOperator,
	"BITWISE_XOR": cpp.ExpressionBinaryOperator,
	"BITWISE_AND": cpp.ExpressionBinaryOperator,
	"EQ": cpp.ExpressionBinaryOperator,
	"NE": cpp.ExpressionBinaryOperator,
	"STRICT_EQ": cpp.ExpressionBinaryOperator,
	"STRICT_NE": cpp.ExpressionBinaryOperator,
	"LT": cpp.ExpressionBinaryOperator,
	"LE": cpp.ExpressionBinaryOperator,
	"GE": cpp.ExpressionBinaryOperator,
	"GT": cpp.ExpressionBinaryOperator,
	"INSTANCEOF": cpp.ExpressionBinaryOperator,
	"LSH": cpp.ExpressionBinaryOperator,
	"RSH": cpp.ExpressionBinaryOperator,
	"URSH": cpp.ExpressionBinaryOperator,
	"PLUS": cpp.ExpressionBinaryOperator,
	"MINUS": cpp.ExpressionBinaryOperator,
	"MUL": cpp.ExpressionBinaryOperator,
	"DIV": cpp.ExpressionBinaryOperator,
	"MOD": cpp.ExpressionBinaryOperator,
	"DOT": cpp.ExpressionBinaryOperator,
	"INCREMENT": cpp.ExpressionPostOperator,
	"DECREMENT": cpp.ExpressionPostOperator,
	"LEFT_BRACKET": cpp.ExpressionIndex,
	"RIGHT_BRACKET": cpp.ExpressionRightBracket,
	"LEFT_PAREN": cpp.ExpressionCall,
	"RIGHT_PAREN": cpp.ExpressionRightParen
}

})();

Crunchy.tokenstr = tokenstr;
Crunchy.parse = function(s, f, l) {
	var p = new Crunchy.Parser;
	return p.parse(s, f, l);
}
})();
