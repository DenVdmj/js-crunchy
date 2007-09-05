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

/*
 * Narcissus - JS implemented in JS.
 *
 * Well-known constants and lookup tables.	Many consts are generated from the
 * tokens table via eval to minimize redundancy, so consumers must be compiled
 * separately to take advantage of the simple switch-case constant propagation
 * done by SpiderMonkey.
 */

Crunchy.tokens = [
	// End of source.
	"END",

	// Operators and punctuators.  Some pair-wise order matters, e.g. (+, -)
	// and (UNARY_PLUS, UNARY_MINUS).
	"\n", ";", ";;;",
	",",
	"=",
	"?", ":", "CONDITIONAL",
	"||",
	"&&",
	"|",
	"^",
	"&",
	"==", "!=", "===", "!==",
	"<", "<=", ">=", ">",
	"<<", ">>", ">>>",
	"+", "-",
	"*", "/", "%",
	"!", "~", "UNARY_PLUS", "UNARY_MINUS",
	"++", "--",
	".",
	"[", "]",
	"{", "}",
	"(", ")",

	// Nonterminal tree node type codes.
	"SCRIPT", "BLOCK", "LABEL", "FOR_IN", "CALL", "NEW_WITH_ARGS", "INDEX",
	"ARRAY_INIT", "OBJECT_INIT", "PROPERTY_INIT", "GETTER", "SETTER",
	"GROUP", "LIST",

	// Terminals.
	"IDENTIFIER", "MEMBER_IDENTIFIER", "NUMBER", "STRING", "REGEXP",
	// New terminal to represent an empty array parameter:
	"EMPTY",

	// Keywords.
	"break",
	"case", "catch", "continue",
	"default", "delete", "do",
	"else",
	"finally", "for", "function",
	"if", "in", "instanceof",
	"new", 
	"return",
	"switch",
	"this", "throw", "try", "typeof",
	"var", "void",
	"while", "with",

	// Boolean Literals (not keywords?)
	"true", "false",

	// Null Literal
	"null",

	// TODO: I should probably accept the future keywords as identifiers

	// es4 keywords (enum is currently 'sort of parsed')
	
	"class", "enum", "extends", "super",

	// Contextually reserved identifiers (debugger, const 'sort of parsed')

	"const", "debugger", "double", "final", "implements", "import", "int",
	"interface", "native", "package", "private", "protected", "public",
	"static",

	// Formerly future keywords, but no longer that I support anyway because I
	// like to be harmful.
	//
	// TODO: Make this an option.

	"goto" 
];

// Operator and punctuator mapping from token to tree node type name.
// NB: superstring tokens (e.g., ++) must come before their substring token
// counterparts (+ in the example), so that the opRegExp regular expression
// synthesized from this list makes the longest possible match.
Crunchy.opTypeNames = {
	'\n':	"NEWLINE",
	';':	"SEMICOLON",
	';;;':	"DEBUG_SEMICOLON",
	',':	"COMMA",
	'?':	"HOOK",
	':':	"COLON",
	'||':	"OR",
	'&&':	"AND",
	'|':	"BITWISE_OR",
	'^':	"BITWISE_XOR",
	'&':	"BITWISE_AND",
	'===':	"STRICT_EQ",
	'==':	"EQ",
	'=':	"ASSIGN",
	'!==':	"STRICT_NE",
	'!=':	"NE",
	'<<':	"LSH",
	'<=':	"LE",
	'<':	"LT",
	'>>>':	"URSH",
	'>>':	"RSH",
	'>=':	"GE",
	'>':	"GT",
	'++':	"INCREMENT",
	'--':	"DECREMENT",
	'+':	"PLUS",
	'-':	"MINUS",
	'*':	"MUL",
	'/':	"DIV",
	'%':	"MOD",
	'!':	"NOT",
	'~':	"BITWISE_NOT",
	'.':	"DOT",
	'[':	"LEFT_BRACKET",
	']':	"RIGHT_BRACKET",
	'{':	"LEFT_CURLY",
	'}':	"RIGHT_CURLY",
	'(':	"LEFT_PAREN",
	')':	"RIGHT_PAREN"
};

// TODO: Add missing precedences (INDEX? Any others?)
Crunchy.opPrecedence = {
	SEMICOLON: 0,
	COMMA: 1,
	ASSIGN: 2, HOOK: 2, COLON: 2, CONDITIONAL: 2,
	// The above all have to have the same precedence, see bug 330975.
	OR: 4,
	AND: 5,
	BITWISE_OR: 6,
	BITWISE_XOR: 7,
	BITWISE_AND: 8,
	EQ: 9, NE: 9, STRICT_EQ: 9, STRICT_NE: 9,
	LT: 10, LE: 10, GE: 10, GT: 10, IN: 10, INSTANCEOF: 10,
	LSH: 11, RSH: 11, URSH: 11,
	PLUS: 12, MINUS: 12,
	MUL: 13, DIV: 13, MOD: 13,
	DELETE: 14, VOID: 14, TYPEOF: 14, // PRE_INCREMENT: 14, PRE_DECREMENT: 14,
	NOT: 14, BITWISE_NOT: 14, UNARY_PLUS: 14, UNARY_MINUS: 14,
	INCREMENT: 15, DECREMENT: 15,	  // postfix
	NEW: 16,
	DOT: 17
};

Crunchy.opArity = {
	COMMA: -2,
	ASSIGN: 2,
	CONDITIONAL: 3,
	OR: 2,
	AND: 2,
	BITWISE_OR: 2,
	BITWISE_XOR: 2,
	BITWISE_AND: 2,
	EQ: 2, NE: 2, STRICT_EQ: 2, STRICT_NE: 2,
	LT: 2, LE: 2, GE: 2, GT: 2, IN: 2, INSTANCEOF: 2,
	LSH: 2, RSH: 2, URSH: 2,
	PLUS: 2, MINUS: 2,
	MUL: 2, DIV: 2, MOD: 2,
	DELETE: 1, VOID: 1, TYPEOF: 1,	// PRE_INCREMENT: 1, PRE_DECREMENT: 1,
	NOT: 1, BITWISE_NOT: 1, UNARY_PLUS: 1, UNARY_MINUS: 1,
	INCREMENT: 1, DECREMENT: 1,		// postfix
	NEW: 1, NEW_WITH_ARGS: 2, DOT: 2, INDEX: 2, CALL: 2,
	ARRAY_INIT: 1, OBJECT_INIT: 1, GROUP: 1
};

var keywords = {};

// Define const END, etc., based on the token names.  Also map name to index.
for (var i = 0, j = Crunchy.tokens.length; i < j; i++) {
	var t = Crunchy.tokens[i];
	if (/^[a-z]/.test(t)) {
		var tt = t.toUpperCase();
		keywords[t] = tt;
	} else {
		var tt = /^\W/.test(t) ? Crunchy.opTypeNames[t] : t
	}
	Crunchy.tokens[t] = tt;
	Crunchy.tokens[tt] = t;
}

Crunchy.lookupKeyword = function(keyword) {
	return keywords[keyword] || false;
}

// Map assignment operators to their indexes in the tokens array.
Crunchy.assignOps = ['|', '^', '&', '<<', '>>', '>>>', '+', '-', '*', '/', '%'];

for (i = 0, j = Crunchy.assignOps.length; i < j; i++) {
	t = Crunchy.assignOps[i];
	Crunchy.assignOps[t + '='] = Crunchy.tokens[t];
}
