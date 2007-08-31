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

function Script(t) {
	var n = new Node(t, "SCRIPT");
	n.setBody(ParseCompilerContext(t, n, false));
	return n;
}

function ParseCompilerContext(t, n, inFunction) {
	var x = new CompilerContext(inFunction);
	var nodes = Statements(t, x);
	n.funDecls = x.funDecls;
	n.varDecls = x.varDecls;
	return nodes;
}

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
	IDENTIFIER : ["initializer"] // also name, readOnly
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
		this.lineno = token.lineno;
		this.start = token.start;
		this.end = token.end;
	} else {
		this.type = type;
		this.lineno = t.lineno;
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

// Always use pushOperand to add operands to an expression, to update start and end.

Np.fixToken = function (kid) {
	if (kid.start < this.start)
		this.start = kid.start;
	if (this.end < kid.end)
		this.end = kid.end;
	return kid;
}

Np.pushOperand = function (kid) {
	this.fixToken(kid);
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

Np.getSource = function () {
	return this.tokenizer.source.slice(this.start, this.end);
};

Np.filename = function () { return this.tokenizer.filename; };

function Statements(t, x) {
	var tt,nodes = [];
	while ((tt = t.peekOperand()) != "END" && tt != "RIGHT_CURLY")
		nodes = nodes.concat(Statement(t, x));
	return nodes;
}

function Block(t, x) {
	t.mustMatchOperand("LEFT_CURLY");
	++x.nestedLevel;
	var nodes = Statements(t, x);
	--x.nestedLevel;
	t.mustMatchOperator("RIGHT_CURLY");
	return nodes;
}

function OptionalBlock(t, x) {
	++x.nestedLevel;
	try {
		if(t.peekOperand() == "LEFT_CURLY") {
			t.mustMatchOperand("LEFT_CURLY");
			var nodes = Statements(t, x);
			t.mustMatchOperator("RIGHT_CURLY");
			return nodes;
		}
		else {
			return Statement(t, x);
		}
	}
	finally {
		--x.nestedLevel;
	}
}

Crunchy.DECLARED_FORM = 0;
Crunchy.EXPRESSED_FORM = 1;
Crunchy.STATEMENT_FORM = 2;

function Statement(t, x) {
	// TODO: Here we might have previously called 'peekOperator', and
	// auto-inserted a semi-colon.
	var i, label, nodes, n, n2, ss, tt = t.getOperand();

	// Cases for statements ending in a right curly return early, avoiding the
	// common semicolon insertion magic after this switch.
	switch (tt) {
	  case "FUNCTION":
		return [FunctionDefinition(t, x, true,
				x.nestedLevel > 0 ? Crunchy.STATEMENT_FORM : Crunchy.DECLARED_FORM)];
	  case "LEFT_CURLY":
		n = new Node(t, "BLOCK");
	    ++x.nestedLevel;
		n.children = Statements(t, x);
		--x.nestedLevel;
		t.mustMatchOperator("RIGHT_CURLY");
		return [n];

	  case "IF":
		n = new Node(t, "IF");
		n.setCondition(ParenExpression(t, x));
		n.setThenPart(OptionalBlock(t, x));
		n.setElsePart(t.matchOperator("ELSE") ? OptionalBlock(t, x) : null);
		return [n];

	  case "SWITCH":
		n = new Node(t);
		t.mustMatchOperator("LEFT_PAREN");
		n.setDiscriminant(Expression(t, x));
		t.mustMatchOperator("RIGHT_PAREN");
		var cases = [];
		n.defaultIndex = -1;
		t.mustMatchOperand("LEFT_CURLY");
		++x.nestedLevel;
		try { while ((tt = t.getOperand()) != "RIGHT_CURLY") {
			switch (tt) {
			  case "DEFAULT":
				if (n.defaultIndex >= 0)
					throw t.newSyntaxError("More than one switch default");
				// FALL THROUGH
			  case "CASE":
				n2 = new Node(t);
				if (tt == "DEFAULT")
					n.defaultIndex = cases.length;
				else
					n2.setCaseLabel(Expression(t, x, "COLON"));
				break;
			  default:
				throw t.newSyntaxError("Invalid switch case");
			}
			t.mustMatchOperand("COLON");
			var statements = [];
			while ((tt=t.peekOperand()) != "CASE" && tt != "DEFAULT" && tt != "RIGHT_CURLY")
				statements = statements.concat(Statement(t, x));
			n2.setStatements(statements);
			cases.push(n2);
		}}
		finally {
			--x.nestedLevel;
		}
		n.setCases(cases);
		return [n];

	  case "FOR":
		n = new Node(t, "");
		n.isLoop = true;
		t.mustMatchOperator("LEFT_PAREN");
		if ((tt = t.peekOperand()) != "SEMICOLON") {
			x.inForLoopInit = true;
			if (tt == "VAR" || tt == "CONST") {
				t.getOperand();
				n2 = Variables(t, x);
			} else {
				n2 = Expression(t, x);
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
			n.setObject(Expression(t, x));
		} else {
			n.setType("FOR");
			n.setSetup(n2 || null);
			t.mustMatchOperator("SEMICOLON");
			n.setCondition((t.peekOperand() == "SEMICOLON") ? null : Expression(t, x));
			t.mustMatchOperator("SEMICOLON");
			n.setUpdate((t.peekOperand() == "RIGHT_PAREN") ? null : Expression(t, x));
		}
		t.mustMatchOperator("RIGHT_PAREN");
		n.setBody(OptionalBlock(t, x));
		return [n];

	  case "WHILE":
		n = new Node(t);
		n.isLoop = true;
		n.setCondition(ParenExpression(t, x));
		n.setBody(OptionalBlock(t, x));
		return [n];

	  case "DO":
		n = new Node(t);
		n.isLoop = true;
		// TODO: I forget if the block really is optional.
		n.setBody(OptionalBlock(t, x));
		t.mustMatchOperand("WHILE");
		n.setCondition(ParenExpression(t, x));
		if (!x.ecmaStrictMode) {
			// <script language="JavaScript"> (without version hints) may need
			// automatic semicolon insertion without a newline after do-while.
			// See http://bugzilla.mozilla.org/show_bug.cgi?id=238945.
			t.matchOperand("SEMICOLON");
			return [n];
		}
		break;

	  case "BREAK":
	  case "CONTINUE":
		n = new Node(t);
		if (t.peekOnSameLine() == "IDENTIFIER") {
			t.getOperand();
			n.label = t.token().value;
		}
		break;

	  case "TRY":
		n = new Node(t);
		n.setTryBlock(Block(t, x));
		var catchClauses = [];
		while (t.matchOperand("CATCH")) {
			n2 = new Node(t);
			t.mustMatchOperator("LEFT_PAREN");
			n2.varName = t.mustMatchOperand("IDENTIFIER").value;
			if (t.matchOperand("IF")) {
				if (x.ecmaStrictMode)
					throw t.newSyntaxError("Illegal catch guard");
				if (catchClauses.length && !catchClauses.top().guard)
					throw t.newSyntaxError("Guarded catch after unguarded");
				n2.setGuard(Expression(t, x));
			} else {
				n2.setGuard(null);
			}
			t.mustMatchOperator("RIGHT_PAREN");
			n2.setBlock(Block(t, x));
			catchClauses.push(n2);
		}
		n.setCatchClauses(catchClauses);
		if (t.matchOperand("FINALLY"))
			n.setFinallyBlock(Block(t, x));
		if (!n.catchClauses.length && !n.finallyBlock)
			throw t.newSyntaxError("Invalid try statement");
		return [n];

	  case "CATCH":
	  case "FINALLY":
		throw t.newSyntaxError(Crunchy.tokens[tt] + " without preceding try");

	  case "THROW":
		n = new Node(t);
		n.setException(Expression(t, x));
		break;

	  case "RETURN":
		if (!x.inFunction)
			throw t.newSyntaxError("Invalid return");
		n = new Node(t);
		tt = t.peekOnSameLine();
		if (tt != "END" && tt != "NEWLINE" && tt != "SEMICOLON" && tt != "DEBUG_SEMICOLON" && tt != "RIGHT_CURLY")
			n.setReturnValue(Expression(t, x));
		break;

	  case "WITH":
		n = new Node(t);
		n.setObject(ParenExpression(t, x));
		// TODO: I forget if with statement requires curlies.
		n.setBody(OptionalBlock(t, x));
		return [n];

	  case "VAR":
	  case "CONST":
		n = Variables(t, x);
		break;

	  case "DEBUGGER":
		n = new Node(t);
		break;

	  case "NEWLINE":
	  case "SEMICOLON":
		return [];

	  case "DEBUG_SEMICOLON":
		var n = new Node(t);
		n.setStatement(Statement(t, x));
		return [n];

	  default:
		if (tt == "IDENTIFIER" && t.peekOperator() == "COLON")
		{
			label = t.token().value;
			t.getOperand();
			n = new Node(t, "LABEL");
			n.label = label;
			n.setStatement(Statement(t, x));
			return [n];
		}

		n = new Node(t, "SEMICOLON");
		t.unget();
		n.setExpression(Expression(t, x));
		n.end = n.expression.end;
		break;
	}

	if (t.lineno == t.token().lineno) {
		tt = t.peekOnSameLine();
		if (tt != "END" && tt != "NEWLINE" && tt != "SEMICOLON" && tt != "DEBUG_SEMICOLON" && tt != "RIGHT_CURLY")
			throw t.newSyntaxError("Missing ; before statement");
	}
	t.matchOperand("SEMICOLON");
	return [n];
}

function FunctionDefinition(t, x, requireName, functionForm) {
	var f = new Node(t);
	// TODO: This doesn't work.
	if (f.type != "FUNCTION")
		f.type = (f.value == "get") ? "GETTER" : "SETTER";
	if (t.matchOperand("IDENTIFIER"))
		f.name = t.token().value;
	else if (requireName)
		throw t.newSyntaxError("Missing function identifier");

	t.mustMatchOperator("LEFT_PAREN");
	var params = [];
	var tt;
	// TODO: This will match function(x,) {}
	while ((tt = t.getOperand()) != "RIGHT_PAREN") {
		if (tt != "IDENTIFIER")
			throw t.newSyntaxError("Missing formal parameter");
		params.push(t.token().value);
		// TODO: Operator/Operand? Either, but operator seems to make more
		// sence
		if (t.peekOperator() != "RIGHT_PAREN")
			t.mustMatchOperator("COMMA");
	}
	f.params = params;

	t.mustMatchOperator("LEFT_CURLY");
	f.setBody(ParseCompilerContext(t, f, true));
	t.mustMatchOperand("RIGHT_CURLY");
	f.end = t.token().end;

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
}

function Variables(t, x) {
	var n = new OperatorNode(t);
	do {
		t.mustMatchOperand("IDENTIFIER");
		var n2 = new Node(t);
		n2.name = n2.value;
		if (t.matchOperator("ASSIGN")) {
			if (t.token().assignOp)
				throw t.newSyntaxError("Invalid variable initialization");
			n2.setInitializer(Expression(t, x, "COMMA"));
		}
		n2.readOnly = (n.type == "CONST");
		n.pushOperand(n2);
		x.varDecls.push(n2);
	} while (t.matchOperator("COMMA"));
	return n;
}

function ParenExpression(t, x) {
	t.mustMatchOperator("LEFT_PAREN");
	var n = Expression(t, x);
	t.mustMatchOperator("RIGHT_PAREN");
	return n;
}

function Expression(t, x, stop) {
	var n, id, tt, operators = [], operands = [];
	var bl = x.bracketLevel, cl = x.curlyLevel, pl = x.parenLevel,
		hl = x.hookLevel;
	var scanOperand = true;

	function reduce() {
		var n = operators.pop();
		var op = n.type;
		var arity = Crunchy.opArity[op];
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
		for (var i = 0; i < arity; i++)
			n.pushOperand(a[i]);

		// Include closing bracket or postfix operator in [start,end).
		if (n.end < t.token().end)
			n.end = t.token().end;

		operands.push(n);
		return n;
	}

loop:
	while ((tt = scanOperand ? t.getOperand() : t.getOperator()) != "END") {
		if (tt == stop &&
			x.bracketLevel == bl && x.curlyLevel == cl && x.parenLevel == pl &&
			x.hookLevel == hl) {
			// Stop only if tt matches the optional stop parameter, and that
			// token is not quoted by some kind of bracket.
			break;
		}
		switch (tt) {
		  case "SEMICOLON":
			// "NB": cannot be empty, Statement handled that.
			break loop;

		  case "ASSIGN":
		  case "HOOK":
		  case "COLON":
			if (scanOperand)
				break loop;
			// Use >, not >=, for right-associative ASSIGN and HOOK/COLON.
			while (Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence[tt] ||
				   (tt == "COLON" && (operators.top().type == "CONDITIONAL" || operators.top().type == "ASSIGN"))) {
				reduce();
			}
			if (tt == "COLON") {
				n = operators.top();
				if (n.type != "HOOK")
					throw t.newSyntaxError("Invalid label");
				n.type = "CONDITIONAL";
				--x.hookLevel;
			} else {
				operators.push(new OperatorNode(t));
				if (tt == "ASSIGN")
					operands.top().assignOp = t.token().assignOp;
				else
					++x.hookLevel;		// tt == HOOK
			}
			scanOperand = true;
			break;

		  case "IN":
			// An in operator should not be parsed if we're parsing the head of
			// a for (...) loop, unless it is in the then part of a conditional
			// expression, or parenthesized somehow.
			if (x.inForLoopInit && !x.hookLevel &&
				!x.bracketLevel && !x.curlyLevel && !x.parenLevel) {
				break loop;
			}
			// FALL THROUGH
		  case "COMMA":
			// Treat comma as left-associative so reduce can fold left-heavy
			// COMMA trees into a single array.
			// FALL THROUGH
		  case "OR":
		  case "AND":
		  case "BITWISE_OR":
		  case "BITWISE_XOR":
		  case "BITWISE_AND":
		  case "EQ": case "NE": case "STRICT_EQ": case "STRICT_NE":
		  case "LT": case "LE": case "GE": case "GT":
		  case "INSTANCEOF":
		  case "LSH": case "RSH": case "URSH":
		  case "PLUS": case "MINUS":
		  case "MUL": case "DIV": case "MOD":
		  case "DOT":
			if (!scanOperand) {
				while (Crunchy.opPrecedence[operators.top().type] >= Crunchy.opPrecedence[tt])
					reduce();
				if (tt == "DOT") {
					var n = new OperatorNode(t, "DOT");
					n.pushOperand(operands.pop());
					t.mustMatchOperand("IDENTIFIER");
					n.pushOperand(new Node(t, "MEMBER_IDENTIFIER"));
					operands.push(n);
				} else {
					operators.push(new OperatorNode(t));
					scanOperand = true;
				}
				break;
			}
			else if(tt != 'PLUS' && tt != 'MINUS') {
				break loop;
			}
			else {
				tt = 'UNARY_' + tt;
				// Fall through...
			}
		  case "DELETE": case "VOID": case "TYPEOF":
		  case "NOT": case "BITWISE_NOT":
		  case "NEW":
			if (!scanOperand)
				break loop;
			operators.push(new OperatorNode(t, tt));
			break;

		  case "INCREMENT": case "DECREMENT":
			if (scanOperand) {
				operators.push(new OperatorNode(t));  // prefix increment or decrement
			} else {
				// Use >, not >=, so postfix has higher precedence than prefix.
				while (Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence[tt])
					reduce();
				n = new OperatorNode(t, tt);
				n.pushOperand(operands.pop());
				n.postfix = true;
				operands.push(n);
			}
			break;

		  case "FUNCTION":
			if (!scanOperand)
				break loop;
			operands.push(FunctionDefinition(t, x, false, Crunchy.EXPRESSED_FORM));
			scanOperand = false;
			break;

		  case "NULL": case "THIS": case "TRUE": case "FALSE":
		  case "IDENTIFIER": case "NUMBER": case "STRING": case "REGEXP":
			if (!scanOperand)
				break loop;
			operands.push(new Node(t));
			scanOperand = false;
			break;

		  case "LEFT_BRACKET":
			if (scanOperand) {
				// Array initialiser.  Parse using recursive descent, as the
				// sub-grammar here is not an operator grammar.
				n = new OperatorNode(t, "ARRAY_INIT");
				while ((tt = t.peekOperand()) != "RIGHT_BRACKET") {
					if (tt == "COMMA") {
						t.getOperand();
						n.pushOperand(new Node(t, "EMPTY"));
						continue;
					}
					n.pushOperand(Expression(t, x, "COMMA"));
					if (!t.matchOperator("COMMA"))
						break;
				}
				t.mustMatchOperator("RIGHT_BRACKET");
				operands.push(n);
				scanOperand = false;
			} else {
				// Property indexing operator.
				operators.push(new OperatorNode(t, "INDEX"));
				scanOperand = true;
				++x.bracketLevel;
			}
			break;

		  case "RIGHT_BRACKET":
			if (scanOperand || x.bracketLevel == bl)
				break loop;
			while (reduce().type != "INDEX")
				continue;
			--x.bracketLevel;
			break;

		  case "LEFT_CURLY":
			if (!scanOperand)
				break loop;
			// Object initialiser.	As for array initialisers (see above),
			// parse using recursive descent.
			++x.curlyLevel;
			n = new OperatorNode(t, "OBJECT_INIT");
		  objectInit:
			if (!t.matchOperand("RIGHT_CURLY")) {
				do {
					tt = t.getOperand();
					if ((t.token().value == "get" || t.token().value == "set") &&
						t.peekOperand() == "IDENTIFIER") {
						if (x.ecmaStrictMode)
							throw t.newSyntaxError("Illegal property accessor");
						n.pushOperand(FunctionDefinition(t, x, true, Crunchy.EXPRESSED_FORM));
					} else {
						switch (tt) {
						  case "IDENTIFIER":
							id = new Node(t, "MEMBER_IDENTIFIER");
							break;
						  case "NUMBER":
						  case "STRING":
							id = new Node(t);
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
						n2.pushOperand(Expression(t, x, "COMMA"));
						n.pushOperand(n2);
					}
				} while (t.matchOperand("COMMA"));
				t.mustMatchOperand("RIGHT_CURLY");
			}
			operands.push(n);
			scanOperand = false;
			--x.curlyLevel;
			break;

		  case "RIGHT_CURLY":
			if (!scanOperand && x.curlyLevel != cl)
				throw "PANIC: right curly botch";
			break loop;

		  case "LEFT_PAREN":
			if (scanOperand) {
				operators.push(new OperatorNode(t, "GROUP"));
			} else {
				while (Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence["NEW"])
					reduce();

				// Handle () now, to regularize the n-ary case for n > 0.
				// We must set scanOperand in case there are arguments and
				// the first one is a regexp or unary+/-.
				n = operators.top();
				scanOperand = true;
				if (t.matchOperand("RIGHT_PAREN")) {
					if (n.type == "NEW") {
						--operators.length;
						n.pushOperand(operands.pop());
					} else {
						n = new OperatorNode(t, "CALL");
						n.pushOperand(operands.pop());
						n.pushOperand(new OperatorNode(t, "LIST"));
					}
					operands.push(n);
					scanOperand = false;
					break;
				}
				if (n.type == "NEW")
					n.type = "NEW_WITH_ARGS";
				else
					operators.push(new OperatorNode(t, "CALL"));
			}
			++x.parenLevel;
			break;

		  case "RIGHT_PAREN":
			if (scanOperand || x.parenLevel == pl)
				break loop;
			while ((tt = reduce().type) != "GROUP" && tt != "CALL" &&
				   tt != "NEW_WITH_ARGS") {
				continue;
			}
			if (tt != "GROUP") {
				n = operands.top();
				var n2 = n.children[1];
				if (n2.type != "COMMA") {
					n.children[1] = new OperatorNode(t, "LIST");
					n.children[1].pushOperand(n2);
				} else
					n.children[1].type = "LIST";
			}
			else {
				n = operands.top();
				if(n.type != "GROUP") throw "Expecting GROUP.";
				if(n.children.length != 1) throw "Expecting GROUP with one child.";
				operands[operands.length - 1] = n.children[0];
			}
			--x.parenLevel;
			break;

		  // Automatic semicolon insertion means we may scan across a newline
		  // and into the beginning of another statement.  If so, break out of
		  // the while loop and let the scanOperand logic handle errors.
		  default:
			break loop;
		}
	}

	if (x.hookLevel != hl)
		throw t.newSyntaxError("Missing : after ?");
	if (x.parenLevel != pl)
		throw t.newSyntaxError("Missing ) in parenthetical");
	if (x.bracketLevel != bl)
		throw t.newSyntaxError("Missing ] in index expression");
	if (scanOperand)
		throw t.newSyntaxError("Missing operand");

	// Resume default mode, scanning for operands, not operators.
	t.unget();
	while (operators.length)
		reduce();
	return operands.pop();
}

function parse(s, f, l) {
	var t = new Crunchy.Tokenizer(s, f, l);
	var n = Script(t);
	if (t.peekOperand() != "END")
		throw t.newSyntaxError("Syntax error");
	return n;
}

Crunchy.parse = parse;
})();
