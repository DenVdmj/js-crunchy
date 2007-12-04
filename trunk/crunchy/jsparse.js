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

Crunchy.CompilerContext = function(inFunction) {
	this.inFunction = inFunction;
	this.nestedLevel = 0;
	this.funDecls = [];
	this.varDecls = [];
}

Crunchy.CompilerContext.prototype = {
	bracketLevel: 0,
	curlyLevel: 0,
	parenLevel: 0,
	hookLevel: 0,
	inForLoopInit: false,

	// TODO: Either pull this out of the prototype or delete it.
	ecmaStrictMode: false
};

Crunchy.NodeTypes = {
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
};

(function() {
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

	for(var i in Crunchy.NodeTypes) Crunchy.NodeTypes[i] = getNodeType(Crunchy.NodeTypes[i]);
})();

Crunchy.Node = function(t, type) {
	var token = t.token();
	if (token) {
		this.type = typeof(type) === "string" ? type : token.type;
		this.value = token.value;
	} else {
		this.type = type;
	}
	this.tokenizer = t;
	this.children = [];

	var info = Crunchy.NodeTypes[this.type];
	if(this.type && info) {
		for(var i in info) this[i] = info[i];
	}
}

Crunchy.OperatorNode = Crunchy.Node;
Crunchy.Node.indentLevel = 0;

Crunchy.Node.prototype = {
	setType: function(type) {
		if(this.type) throw "Type already set";

		var info = Crunchy.NodeTypes[type];
		if(info) {
			for(var i in info) this[i] = info[i];
		}
		this.type = type;
	},

	pushOperand: function (kid) {
		return this.children.push(kid);
	},

	forChildren: function(f) {
		for(var i = 0; i < this.children.length; ++i) {
			var child = this.children[i];
			if(child) {
				if(child.constructor === Array) {
					for(var j = 0; j < child.length; ++j) {
						f(child[j]);
					}
				}
				else {
					f(child);
				}
			}
		}
	},

	toString: function () {
		var a = [];
		for (var i in this) {
			if (this.hasOwnProperty(i) && i != 'type')
				a.push({id: i, value: this[i]});
		}
		a.sort(function (a,b) { return (a.id > b.id) - (a.id < b.id); });
		var INDENTATION = "    ";
		var ident = INDENTATION.repeat(++Crunchy.Node.indentLevel);
		var s = "{\n" + indent + "type: " + Crunchy.tokenstr(this.type);
		for (i = 0; i < a.length; i++)
			s += ",\n" + indent + a[i].id + ": " + a[i].value;
		indent = INDENTATION.repeat(--Crunchy.Node.indentLevel);
		s += "\n" + indent + "}";
		return s;
	},

	filename: function () { return this.tokenizer.filename; }
};

Crunchy.tokenstr = function(tt) {
	var t = Crunchy.tokens[tt];
	return t ? (/^\W/.test(t) ? Crunchy.opTypeNames[t] : t.toUpperCase()) : "(null)";
}

Crunchy.DECLARED_FORM = 0;
Crunchy.EXPRESSED_FORM = 1;
Crunchy.STATEMENT_FORM = 2;

Crunchy.Parser = function() {
}

Crunchy.Parser.prototype = {
	parse: function(s, f, l) {
		this._tokenizer = new Crunchy.Tokenizer(s, f, l);
		var n = this.Script();
		if (this._tokenizer.peekOperand().type != "END")
			throw this._tokenizer.newSyntaxError("Syntax error");
		return n;
	},

	Script: function() {
		var n = new Crunchy.Node(this._tokenizer, "SCRIPT");
		n.setBody(this.ParseCompilerContext(n, false));
		return n;
	},

	ParseCompilerContext: function(n, inFunction) {
		var oldContext = this._context;
		try {
			this._context = new Crunchy.CompilerContext(inFunction);
			var nodes = this.Statements();
			n.funDecls = this._context.funDecls;
			n.varDecls = this._context.varDecls;
			return nodes;
		} finally {
			this._context = oldContext;
		}
	},

	Statements: function() {
		var tt,nodes = [];
		while ((tt = this._tokenizer.peekOperand().type) != "END" && tt != "RIGHT_CURLY")
			nodes = nodes.concat(this.Statement());
		return nodes;
	},

	Block: function() {
		if(this._tokenizer.peekOperand().type != "LEFT_CURLY")
			throw this._tokenizer.newSyntaxError("Code block expected.");
		return this.OptionalBlock();
	},

	OptionalBlock: function() {
		++this._context.nestedLevel;
		var s = this.Statement();
		--this._context.nestedLevel;
		return s;
	},

	Statement: function() {
		// TODO: Here we might have previously called 'peekOperator', and
		// auto-inserted a semi-colon.
		return (this.StatementMethods[this._tokenizer.getOperand()] || this.StatementDefault).call(this);
	},

	StatementFunction: function() {
		return [this.FunctionDefinition(true,
				this._context.nestedLevel > 0 ? Crunchy.STATEMENT_FORM : Crunchy.DECLARED_FORM)];
	},

	StatementLeftCurly: function() {
		++this._context.nestedLevel;
		var children = this.Statements();
		--this._context.nestedLevel;
		this._tokenizer.mustMatchOperator("RIGHT_CURLY");
		if(this._context.nestedLevel === 0) {
			var n = new Crunchy.Node(this._tokenizer, "BLOCK");
			n.children = children;
			return [n];
		}
		else {
			return children;
		}
	},

	StatementIf: function() {
		var n = new Crunchy.Node(this._tokenizer, "IF");
		n.setCondition(this.ParenExpression());
		n.setThenPart(this.OptionalBlock());
		n.setElsePart(this._tokenizer.matchOperator("ELSE") ? this.OptionalBlock() : null);
		return [n];
	},

	StatementSwitch: function() {
		var tt;
		var n = new Crunchy.Node(this._tokenizer);

		this._tokenizer.mustMatchOperator("LEFT_PAREN");
		n.setDiscriminant(this.Expression());
		this._tokenizer.mustMatchOperator("RIGHT_PAREN");

		var cases = [];
		this._tokenizer.mustMatchOperand("LEFT_CURLY");
		++this._context.nestedLevel;
		while ((tt = this._tokenizer.getOperand()) != "RIGHT_CURLY") {			
			var n2 = new Crunchy.Node(this._tokenizer);
			if(tt === "CASE") {
				n2.setCaseLabel(this.Expression("COLON"));
			}
			else if(tt != "DEFAULT") {
				throw this._tokenizer.newSyntaxError("Invalid switch case");
			}
			this._tokenizer.mustMatchOperand("COLON");
			var statements = [];
			while ((tt=this._tokenizer.peekOperand().type) != "CASE" && tt != "DEFAULT" && tt != "RIGHT_CURLY")
				statements = statements.concat(this.Statement());
			n2.setStatements(statements);
			cases.push(n2);
		}
		--this._context.nestedLevel;
		n.setCases(cases);

		return [n];
	},

	StatementFor: function() {
		var n = new Crunchy.Node(this._tokenizer, "");
		n.isLoop = true;
		this._tokenizer.mustMatchOperator("LEFT_PAREN");

		var tt, n2;
		if ((tt = this._tokenizer.peekOperand().type) != "SEMICOLON") {
			this._context.inForLoopInit = true;
			if (tt === "VAR" || tt === "CONST") {
				this._tokenizer.getOperand();
				n2 = this.Variables();
			} else {
				n2 = this.Expression();
			}
			this._context.inForLoopInit = false;
		}

		// TODO: I'm not sure about this...
		// Really it shouldn't matter if I say Operator or Operand
		// but operator seems to be appropriate here - even though it
		// used to Operand.
		if (n2 && this._tokenizer.matchOperator("IN")) {
			n.setType("FOR_IN");
			n.isLoop = true;
			if (n2.type === "VAR" && n2.children.length != 1) {
				throw this._tokenizer.newSyntaxError("Invalid for..in left-hand side");
			}

			n.setIterator(n2);
			n.setObject(this.Expression());
		} else {
			n.setType("FOR");
			n.setSetup(n2 || null);
			this._tokenizer.mustMatchOperator("SEMICOLON");
			n.setCondition((this._tokenizer.peekOperand().type === "SEMICOLON") ? null : this.Expression());
			this._tokenizer.mustMatchOperator("SEMICOLON");
			n.setUpdate((this._tokenizer.peekOperand().type === "RIGHT_PAREN") ? null : this.Expression());
		}
		this._tokenizer.mustMatchOperator("RIGHT_PAREN");
		n.setBody(this.OptionalBlock());
		return [n];
	},

	StatementWhile: function() {
		var n = new Crunchy.Node(this._tokenizer);
		n.isLoop = true;
		n.setCondition(this.ParenExpression());
		n.setBody(this.OptionalBlock());
		return [n];
	},

	StatementDo: function() {
		var n = new Crunchy.Node(this._tokenizer);
		n.isLoop = true;
		// TODO: I forget if the block really is optional.
		n.setBody(this.OptionalBlock());
		this._tokenizer.mustMatchOperand("WHILE");
		n.setCondition(this.ParenExpression());

		// Several javascript implementations allow automatic semicolon
		// insertion without a newline after do-while.
		// See http://bugzilla.mozilla.org/show_bug.cgi?id=238945.
		if (this._context.ecmaStrictMode) this.StatementEnd(); 
		else this._tokenizer.matchOperand("SEMICOLON");
		return [n];
	},

	StatementBreakContinue: function() {
		var n = new Crunchy.Node(this._tokenizer);
		if (this._tokenizer.peekOnSameLine().isProperty) {
			this._tokenizer.getOperand();
			n.label = this._tokenizer.token().value;
		}
		this.StatementEnd();
		return [n];
	},

	StatementTry: function() {
		var n = new Crunchy.Node(this._tokenizer);
		n.setTryBlock(this.Block());
		var catchClauses = [];
		while (this._tokenizer.matchOperand("CATCH")) {
			var n2 = new Crunchy.Node(this._tokenizer);
			this._tokenizer.mustMatchOperator("LEFT_PAREN");
			// TODO: isProperty
			n2.varName = this._tokenizer.mustMatchOperand("IDENTIFIER").value;
			if (this._tokenizer.matchOperand("IF")) {
				if (this._context.ecmaStrictMode)
					throw this._tokenizer.newSyntaxError("Illegal catch guard");
				if (catchClauses.length && !catchClauses.top().guard)
					throw this._tokenizer.newSyntaxError("Guarded catch after unguarded");
				n2.setGuard(this.Expression());
			} else {
				n2.setGuard(null);
			}
			this._tokenizer.mustMatchOperator("RIGHT_PAREN");
			n2.setBlock(this.Block());
			catchClauses.push(n2);
		}
		n.setCatchClauses(catchClauses);
		if (this._tokenizer.matchOperand("FINALLY"))
			n.setFinallyBlock(this.Block());
		if (!n.catchClauses.length && !n.finallyBlock)
			throw this._tokenizer.newSyntaxError("Invalid try statement");
		return [n];
	},

	StatementCatchFinally: function() {
		throw this._tokenizer.newSyntaxError("catch/finally without preceding try");
	},

	StatementThrow: function() {
		var n = new Crunchy.Node(this._tokenizer);
		n.setException(this.Expression());
		this.StatementEnd();
		return [n];
	},

	StatementReturn: function() {
		if (!this._context.inFunction)
			throw this._tokenizer.newSyntaxError("Invalid return");
		var n = new Crunchy.Node(this._tokenizer);
		var tt = this._tokenizer.peekOnSameLine().type;
		if (tt != "END" && tt != "NEWLINE" && tt != "SEMICOLON" && tt != "DEBUG_SEMICOLON" && tt != "RIGHT_CURLY")
			n.setReturnValue(this.Expression());
		this.StatementEnd();
		return [n];
	},

	StatementWith: function() {
		var n = new Crunchy.Node(this._tokenizer);
		n.setObject(this.ParenExpression());
		// TODO: I forget if with statement requires curlies.
		n.setBody(this.OptionalBlock());
		return [n];
	},

	StatementVarConst: function() {
		var n = this.Variables();
		this.StatementEnd();
		return [n];
	},

	StatementDebugger: function() {
		var n = new Crunchy.Node(this._tokenizer);
		this.StatementEnd();
		return [n];
	},

	// Newline/Semi-colon
	StatementEmpty: function() {
		return [];
	},

	StatementDebugSemicolon: function() {
		var n = new Crunchy.Node(this._tokenizer);
		n.setStatement(this.Statement());
		return [n];
	},

	StatementDefault: function() {
		if (this._tokenizer.token().isProperty && this._tokenizer.peekOperator().type === "COLON")
		{
			var label = this._tokenizer.token().value;
			this._tokenizer.getOperand();
			var n = new Crunchy.Node(this._tokenizer, "LABEL");
			n.label = label;
			n.setStatement(this.Statement());
			return [n];
		}
		else {
			var n = new Crunchy.Node(this._tokenizer, "SEMICOLON");
			this._tokenizer.unget();
			n.setExpression(this.Expression());
			this.StatementEnd();
			return [n];
		}
	},

	// Extensions:
	
	StatementGoto: function() {
		// TODO: Peek for operators not operands. Why? If goto is the first token in an expression, the next is an operator. If goto is the first token
		// in a goto statement, the next token is a label - which will be correctly identified by a peek operator call.
		var tt = this._tokenizer.peekOnSameLine();

		if(tt.isProperty) {
			// TODO: Duplicate of BREAK/CONTINUE (sort of).
			var n = new Crunchy.Node(this._tokenizer);
			this._tokenizer.getOperand();
			n.label = this._tokenizer.token().value;
			this.StatementEnd();
			return [n];
		}
		else {
			return this.StatementDefault();
		}
	},

	StatementEnd: function() {
		if (this._tokenizer.lineno === this._tokenizer.token().lineno) {
			tt = this._tokenizer.peekOnSameLine().type;
			if (tt != "END" && tt != "NEWLINE" && tt != "SEMICOLON" && tt != "DEBUG_SEMICOLON" && tt != "RIGHT_CURLY")
				throw this._tokenizer.newSyntaxError("Missing ; before statement");
		}
		this._tokenizer.matchOperand("SEMICOLON");
	},

	FunctionDefinition: function(requireName, functionForm) {
		var token = this._tokenizer.token();

		if(token.type === "FUNCTION") var type = "FUNCTION";
		else if(token.value === "get") var type = "GETTER";
		else if(token.value === "set") var type = "SETTER";
		else throw("Invalid function.")

		var f = new Crunchy.Node(this._tokenizer, type);

		// TODO: isProperty
		if (this._tokenizer.matchOperand("IDENTIFIER"))
			f.name = this._tokenizer.token().value;
		else if (requireName)
			throw this._tokenizer.newSyntaxError("Missing function identifier");

		this._tokenizer.mustMatchOperator("LEFT_PAREN");
		var params = [];
		var tt;
		// TODO: This will match function(x,) {}
		while ((tt = this._tokenizer.getOperand()) != "RIGHT_PAREN") {
			// TODO: isProperty
			if (tt != "IDENTIFIER")
				throw this._tokenizer.newSyntaxError("Missing formal parameter");
			params.push(this._tokenizer.token().value);
			// TODO: Operator/Operand? Either, but operator seems to make more
			// sence
			if (this._tokenizer.peekOperator().type != "RIGHT_PAREN")
				this._tokenizer.mustMatchOperator("COMMA");
		}
		f.params = params;

		this._tokenizer.mustMatchOperator("LEFT_CURLY");
		f.setBody(this.ParseCompilerContext(f, true));
		this._tokenizer.mustMatchOperand("RIGHT_CURLY");

		f.functionForm = functionForm;

		// If functionForm === Crunchy.STATEMENT_FORM then we have something like:
		//
		// if(true) { function foo(); }
		//
		// On some implementations foo is only added to the declarations when
		// it has been executed. So it could possibly be added in a 'might match'
		// style. But for now it makes sense to say that it's the same variable as
		// any in the enclosing blocks.

		if (functionForm === Crunchy.DECLARED_FORM)
			this._context.funDecls.push(f);
		return f;
	},

	Variables: function() {
		var n = new Crunchy.OperatorNode(this._tokenizer);
		do {
			// TODO: isProperty
			this._tokenizer.mustMatchOperand("IDENTIFIER");
			var n2 = new Crunchy.Node(this._tokenizer);
			n2.name = n2.value;
			if (this._tokenizer.matchOperator("ASSIGN")) {
				if (this._tokenizer.token().assignOp)
					throw this._tokenizer.newSyntaxError("Invalid variable initialization");
				n2.setInitializer(this.Expression("COMMA"));
			}
			n2.readOnly = (n.type === "CONST");
			n.pushOperand(n2);
			this._context.varDecls.push(n2);
		} while (this._tokenizer.matchOperator("COMMA"));
		return n;
	},

	ParenExpression: function() {
		this._tokenizer.mustMatchOperator("LEFT_PAREN");
		var n = this.Expression();
		this._tokenizer.mustMatchOperator("RIGHT_PAREN");
		return n;
	},

	Expression: function(stop) {
		var tt, operators = [], operands = [];
		var state = { bl : this._context.bracketLevel, cl : this._context.curlyLevel, pl : this._context.parenLevel, hl : this._context.hookLevel, scanOperand : true };

		do {
			// NOTE: If tt === END, a method won't be found and the loop will exit
			// normally.
			tt = this._tokenizer.getToken(state.scanOperand);

			// Stop if tt matches the optional stop parameter, and that
			// token is not quoted by some kind of bracket.
			if (tt === stop &&
				this._context.bracketLevel === state.bl && this._context.curlyLevel === state.cl && this._context.parenLevel === state.pl &&
				this._context.hookLevel === state.hl) {
				break;
			}

			var f = (state.scanOperand ? this.OperandMethods : this.OperatorMethods)[tt];
		} while(f && f.call(this, tt, state, operators, operands));

		if (this._context.hookLevel != state.hl)
			throw this._tokenizer.newSyntaxError("Missing : after ?");
		if (this._context.parenLevel != state.pl)
			throw this._tokenizer.newSyntaxError("Missing ) in parenthetical");
		if (this._context.bracketLevel != state.bl)
			throw this._tokenizer.newSyntaxError("Missing ] in index expression");
		if (state.scanOperand)
			throw this._tokenizer.newSyntaxError("Missing operand");

		// Resume default mode, scanning for operands, not operators.
		this._tokenizer.unget();
		while (operators.length)
			this.ReduceExpression(operators, operands);
		return operands.pop();
	},

	// Operator Methods

	ExpressionUnaryOperator: function(tt, state, operators, operands) {
		if(tt === 'PLUS' || tt === 'MINUS') tt = 'UNARY_' + tt;
		operators.push(new Crunchy.OperatorNode(this._tokenizer, tt));
		return true;
	},

	ExpressionFunction: function(tt, state, operators, operands) {
		operands.push(this.FunctionDefinition(false, Crunchy.EXPRESSED_FORM));
		state.scanOperand = false;
		return true;
	},

	ExpressionOperand: function(tt, state, operators, operands) {
		var n = new Crunchy.Node(this._tokenizer);
		if(n.type === "IDENTIFIER")
			n.name = n.value;
		operands.push(n);
		state.scanOperand = false;
		return true;
	},

	ExpressionArrayInit: function(tt, state, operators, operands) {
		// Array initialiser.  Parse using recursive descent, as the
		// sub-grammar here is not an operator grammar.
		var n = new Crunchy.OperatorNode(this._tokenizer, "ARRAY_INIT");
		while ((tt = this._tokenizer.peekOperand().type) != "RIGHT_BRACKET") {
			if (tt === "COMMA") {
				this._tokenizer.getOperand();
				n.pushOperand(new Crunchy.Node(this._tokenizer, "EMPTY"));
				continue;
			}
			n.pushOperand(this.Expression("COMMA"));
			if (!this._tokenizer.matchOperator("COMMA"))
				break;
		}
		this._tokenizer.mustMatchOperator("RIGHT_BRACKET");
		operands.push(n);
		state.scanOperand = false;
		return true;
	},

	ExpressionLeftCurly: function(tt, state, operators, operands) {
		// Object initialiser.	As for array initialisers (see above),
		// parse using recursive descent.
		++this._context.curlyLevel;
		var n = new Crunchy.OperatorNode(this._tokenizer, "OBJECT_INIT");
	  objectInit:
		if (!this._tokenizer.matchOperand("RIGHT_CURLY")) {
			do {
				tt = this._tokenizer.getOperand();
				if ((this._tokenizer.token().value === "get" || this._tokenizer.token().value === "set") &&
					this._tokenizer.peekOperand().type === "IDENTIFIER") {
					if (this._context.ecmaStrictMode)
						throw this._tokenizer.newSyntaxError("Illegal property accessor");
					n.pushOperand(this.FunctionDefinition(true, Crunchy.EXPRESSED_FORM));
				} else {
					// TODO: isProperty (or all keywords?)
					switch (tt) {
					  case "IDENTIFIER":
						var id = new Crunchy.Node(this._tokenizer, "MEMBER_IDENTIFIER");
						break;
					  case "NUMBER":
					  case "STRING":
						var id = new Crunchy.Node(this._tokenizer);
						break;
					  case "RIGHT_CURLY":
						if (this._context.ecmaStrictMode)
							throw this._tokenizer.newSyntaxError("Illegal trailing ,");
						break objectInit;
					  default:
						throw this._tokenizer.newSyntaxError("Invalid property name");
					}
					this._tokenizer.mustMatchOperator("COLON");
					var n2 = new Crunchy.OperatorNode(this._tokenizer, "PROPERTY_INIT");
					n2.pushOperand(id);
					n2.pushOperand(this.Expression("COMMA"));
					n.pushOperand(n2);
				}
			} while (this._tokenizer.matchOperand("COMMA"));
			this._tokenizer.mustMatchOperand("RIGHT_CURLY");
		}
		operands.push(n);
		state.scanOperand = false;
		--this._context.curlyLevel;
		return true;
	},

	ExpressionRightCurly: function(tt, state, operators, operands) {
		if (this._context.curlyLevel != state.cl) throw "PANIC: right curly botch";
		return false;
	},

	ExpressionGroup: function(tt, state, operators, operands) {
		operators.push(new Crunchy.OperatorNode(this._tokenizer, "GROUP"));
		++this._context.parenLevel;
		return true;
	},

	// Operator Methods

	ExpressionRightAssociative: function(tt, state, operators, operands) {
		// Use >, not >=, for right-associative operators.
		while (operators.length && Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence[tt])
			this.ReduceExpression(operators, operands);

		operators.push(new Crunchy.OperatorNode(this._tokenizer));
		if (tt === "ASSIGN")
			operands.top().assignOp = this._tokenizer.token().assignOp;
		else
			++this._context.hookLevel;		// tt === HOOK

		state.scanOperand = true;
		return true;
	},

	ExpressionColon: function(tt, state, operators, operands) {
		// Use >, not >=, for right-associative operators.
		while (operators.length && (Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence[tt] ||
			operators.top().type === "CONDITIONAL" || operators.top().type === "ASSIGN"))
			this.ReduceExpression(operators, operands);

		var n = operators.top();
		if (!n || n.type != "HOOK")
			throw this._tokenizer.newSyntaxError("Invalid label");
		n.type = "CONDITIONAL";
		--this._context.hookLevel;

		state.scanOperand = true;
		return true;
	},

	ExpressionBinaryOperator: function(tt, state, operators, operands) {
		// An in operator should not be parsed if we're parsing the head of
		// a for (...) loop, unless it is in the then part of a conditional
		// expression, or parenthesized somehow.
		if(tt === "IN" && (this._context.inForLoopInit && !this._context.hookLevel &&
			!this._context.bracketLevel && !this._context.curlyLevel && !this._context.parenLevel))
				return false;

		while (operators.length && Crunchy.opPrecedence[operators.top().type] >= Crunchy.opPrecedence[tt])
			this.ReduceExpression(operators, operands);
		if (tt === "DOT") {
			var n = new Crunchy.OperatorNode(this._tokenizer, "DOT");
			n.pushOperand(operands.pop());
			// TODO: isProperty
			this._tokenizer.mustMatchOperand("IDENTIFIER");
			n.pushOperand(new Crunchy.Node(this._tokenizer, "MEMBER_IDENTIFIER"));
			operands.push(n);
		} else {
			operators.push(new Crunchy.OperatorNode(this._tokenizer));
			state.scanOperand = true;
		}
		return true;
	},

	ExpressionPostOperator: function(tt, state, operators, operands) {
		// Use >, not >=, so postfix has higher precedence than prefix.
		while (operators.length && Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence[tt])
			this.ReduceExpression(operators, operands);
		var n = new Crunchy.OperatorNode(this._tokenizer, tt);
		n.pushOperand(operands.pop());
		n.postfix = true;
		operands.push(n);
		return true;
	},

	ExpressionIndex: function(tt, state, operators, operands) {
		// Property indexing operator.
		operators.push(new Crunchy.OperatorNode(this._tokenizer, "INDEX"));
		state.scanOperand = true;
		++this._context.bracketLevel;
		return true;
	},

	ExpressionRightBracket: function(tt, state, operators, operands) {
		if (this._context.bracketLevel === state.bl) return false;
		while (this.ReduceExpression(operators, operands).type != "INDEX")
			continue;
		--this._context.bracketLevel;
		return true;
	},

	ExpressionCall: function(tt, state, operators, operands) {
		while (operators.length && Crunchy.opPrecedence[operators.top().type] > Crunchy.opPrecedence["NEW"])
			this.ReduceExpression(operators, operands);

		// Handle () now, to regularize the n-ary case for n > 0.
		// We must set scanOperand in case there are arguments and
		// the first one is a regexp or unary+/-.
		var n = operators.top();
		state.scanOperand = true;
		if (this._tokenizer.matchOperand("RIGHT_PAREN")) {
			if (n && n.type === "NEW") {
				--operators.length;
				n.pushOperand(operands.pop());
			} else {
				n = new Crunchy.OperatorNode(this._tokenizer, "CALL");
				n.pushOperand(operands.pop());
				n.pushOperand(new Crunchy.OperatorNode(this._tokenizer, "LIST"));
			}
			operands.push(n);
			state.scanOperand = false;
			return true;
		}
		if (n && n.type === "NEW")
			n.type = "NEW_WITH_ARGS";
		else
			operators.push(new Crunchy.OperatorNode(this._tokenizer, "CALL"));

		++this._context.parenLevel;
		return true;
	},

	ExpressionRightParen: function(tt, state, operators, operands) {
		if (this._context.parenLevel === state.pl) return false;
		while ((tt = this.ReduceExpression(operators, operands).type) != "GROUP" && tt != "CALL" &&
			   tt != "NEW_WITH_ARGS") {
			continue;
		}
		if (tt != "GROUP") {
			var n = operands.top();
			var last = n.children.length - 1;
			var n2 = n.children[last];
			if (n2.type != "COMMA") {
				n.children[last] = new Crunchy.OperatorNode(this._tokenizer, "LIST");
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
		--this._context.parenLevel;
		return true;
	},

	ReduceExpression: function(operators, operands) {
		var n = operators.pop();
		var op = n.type;
		var arity = Crunchy.opArity[op];
		var origArity = arity;

		if (arity === -2) {
			// Flatten left-associative trees.
			var left = operands.length >= 2 && operands[operands.length-2];
			if (left.type === op) {
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
		if(origArity === 2 && a[0].type === op) {
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

cpp.StatementMethods = {
	"FUNCTION": cpp.StatementFunction,
	"LEFT_CURLY": cpp.StatementLeftCurly,
	"IF": cpp.StatementIf,
	"SWITCH": cpp.StatementSwitch,
	"FOR": cpp.StatementFor,
	"WHILE": cpp.StatementWhile,
	"DO": cpp.StatementDo,
	"BREAK": cpp.StatementBreakContinue,
	"CONTINUE": cpp.StatementBreakContinue,
	"TRY": cpp.StatementTry,
	"CATCH": cpp.StatementCatchFinally,
	"FINALLY": cpp.StatementCatchFinally,
	"THROW": cpp.StatementThrow,
	"RETURN": cpp.StatementReturn,
	"WITH": cpp.StatementWith,
	"VAR": cpp.StatementVarConst,
	"CONST": cpp.StatementVarConst,
	"DEBUGGER": cpp.StatementDebugger,
	"NEWLINE": cpp.StatementEmpty,
	"SEMICOLON": cpp.StatementEmpty,
	"DEBUG_SEMICOLON": cpp.StatementDebugSemicolon,
// Extensions
	"GOTO": cpp.StatementGoto
}

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

Crunchy.parse = function(s, f, l) {
	var p = new Crunchy.Parser;
	return p.parse(s, f, l);
}
