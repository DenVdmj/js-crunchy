load("crunchy.js");

function runTest(code, test) {
	var errors = []

	try {
		var crunched = Crunchy.crunch(code);
	}
	catch(e) {
		errors[errors.length] = 'Crunch errror: ' + e;
	}

	var result1 = runTestImpl("original code", code, test, errors);
	if(crunched) {
		var result2 = runTestImpl("crunched code", crunched, test, errors);

		if(result1 !== result2) {
			errors[errors.length]= 'Inconsistent results, result1: ' + result1 + ' result2: ' + result2;
		}
	}

	if(errors.length) {
		print("Errors:");
		for(var i = 0; i < errors.length; ++i) {
			print((i + 1) + ': ' + errors[i]);
		}
		print("");
		print("Original code:");
		print(code);
		print("");
		if(crunched) {
			print("Crunched code:");
			print(crunched);
			print("");
		}
		print("");
	}
}

function runTestImpl($$$label, $$$code, $$$test, $$$errors) {
	function test(result) {
		if(!result) {
			$$$errors[$$$errors.length] = 'Error running ' + $$$label
		}
	}

	var finalResult;

	function test_result(result) {
		finalResult = result;
	}

	try {
		eval($$$code);
		eval($$$test);
	}
	catch(e) {
		$$$errors[$$$errors.length] = 'Exception running ' + $$$label + ': ' + e
	}

	return finalResult;
}

if(Crunchy.crunch("a=b=c").length > 5) print("Bad crunching 1.");
if(Crunchy.crunch("if(x==a)if(y==b)z()").length > 19) print("Bad crunching 2.");
if(Crunchy.crunch("function x() { var spiffy; }").length > 19) print("Bad crunching 3.");
if(Crunchy.crunch("function x(){var start_button}").length > 19) print("Bad crunching 4.");
if(Crunchy.crunch("try{}catch(error){}").length > 15) print("Bad crunching 5.");
if(Crunchy.crunch("if(a==b){if(c==d)z()}").length > 19) print("Bad crunching 6.");
if(Crunchy.crunch("function x() { function foo() {} }").length > 28) print("Bad crunching 6.");
if(Crunchy.crunch("const x = 1; const y = 2; var a = 3; var b = 4;").length > 25) print("Bad crunching 7.");
if(Crunchy.crunch("const x = 'blah' + \" blah\" + 'flip'").length > 23) print("Bad crunching 8.");
// This one's a little tricky. The variable xy should not be renamed, but the final function expression should be.
if(Crunchy.crunch("function test(a) { var xy = 1; eval(a); var b = function xy() {} }") > 17) print("Bad crunching 9.");

runTest("var a=0;(function(){a=1})();", "test(a === 1)")
runTest("var a=0\nfunction test(){}(function(){a=1})()", "test(a === 1)")
runTest("var a=(function(){return\n10})()", "test(typeof(a)=='undefined')")
runTest("{var a = 1}{var b = 2}", "test(a === 1 && b === 2)");
runTest("try{var x = 2} catch(e) {}", "test(x == 2)");
runTest("try{throw 'Hello!'} catch(e) { var x = e }", "test(x === 'Hello!')")
runTest("var x=0; if(false); x=1;", "test(x === 1)")
runTest("var x=0; if(false){} x=1;", "test(x === 1)")

runTest("if(true) { var x = 0; x = 1 }", "test(x === 1)");

runTest("switch(1) { case 1: var x = 0; break; default: x = 1; }", "test(x === 0)");
runTest("switch(0) { case 1: var x = 0; break; default: x = 1; }", "test(x === 1)");

runTest("for(var i = 0; i < 10; ++i);", "test(i === 10)");
runTest("var x=0, map={a:2,b:3}; for(var i in map) x += map[i];", "test(x == 5)");

runTest("var x=2*3+1", "test(x === 7)");
runTest("var x=2*(3+1)", "test(x === 8)");
runTest("var x=(3+1)*2", "test(x === 8)");
runTest("var x=((3+1)*2,0)", "test(x === 0)");

runTest("var x=1,y=2; x=(y=3);", "test(x === 3 && y === 3)");
runTest("var x=1,y=2; x=y=3;", "test(x === 3 && y === 3)");

runTest("function foo() { var x = { abcd : { efgh : 25 } }, abcd=1, efgh=2; return x.abcd.efgh; } var y = foo()", "test(y === 25)");

runTest("var x = true ? true ? 1 : 2 : 3", "test(x === 1)");
runTest("var x = 0; if(!(x=1))x=2;", "test(x === 1)");
runTest("var x = -(2+3)", "test(x === -5)");

runTest("var x=0; if(false){if(true) x=1} else x=2;", "test(x === 2)");

runTest("var f=function(){var test=4; eval('test=0'); return test}", "test(f() === 0)");
runTest("var x=[,]", "test(x.length === 1)");
runTest("var x=[,,]", "test(x.length === 2)");
runTest("var x=[1,]", "test(x.length === 1)");
runTest("var x=[1,,]", "test(x.length === 2)");

runTest("var x=0;if(true)(function(){x=1})()", "test(x === 1)");
runTest("var x=[1],y=[2],z=(x||y)[0]", "test(z === 1)");

runTest("var x=new Function", "test(typeof(x) === 'function')");
runTest("var x=new Function()", "test(typeof(x) === 'function')");
runTest("var x=new Function()()", "test(typeof(x) === 'undefined')");
runTest("var x=(new Function)()", "test(typeof(x) === 'undefined')");

runTest("var x=10;var y=-(--x)", "test(y === -9 && x === 9)");
runTest("var x=10;var y=- --x", "test(y === -9 && x === 9)");
runTest("var x=10;var y=-x--", "test(y === -10 && x === 9)");
runTest("var x=1,y=2,z=x+-y", "test(z === -1)");
runTest("var x=1,y=2,z=x+ +y", "test(z === 3)");
runTest("var x=1,y=2,z=x+++y", "test(x === 2 && y === 2 && z === 3)");
runTest("var x=1,y=2,z=x++ +y", "test(x === 2 && y === 2 && z === 3)");
runTest("var x=1,y=2,z=x+ ++y", "test(x === 1 && y === 3 && z === 4)");
runTest("var x=1,y=2,z=x+++ +y", "test(x === 2 && y === 2 && z === 3)");
runTest("var x=1,y=2,z=x+ + ++y", "test(x === 1 && y === 3 && z === 4)");
runTest("var x=1,y=2,z=x+++ ++y", "test(x === 2 && y === 3 && z === 4)");

runTest("var x;x+x", "");
runTest("var x=4; x /= 2", "test(x === 2)");
runTest("var x=.5", "test(x === .5)")
runTest("var x=0;(function(){return function(){return x=1}})()()", "test(x === 1)");

runTest("function test() { try { var x = 1; throw 1; } catch(e) { return x; } return 0; }; var x = test()",
		"test(x === 1)");

runTest("var x = \"\"", "test(x === \"\")");

// Rhino can't deal with this....
runTest("var x = 'a/c'.replace(/[/]/, 'b')", "test(x === 'abc')");

runTest("function a(){var a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,AA,BB,CC,DD,EE,FF,GG,HH,II,JJ,KK,LL,MM,NN,OO,PP,QQ,RR,SS,TT,UU,VV,WW,XX,YY,ZZ}", "");

runTest("var x;x=(1,2,3)", "test(x === 3)");
runTest("var x; function run(){var foo={bar: true}, bar=false; with(foo) {x = bar}}; run();", "test(x)");

runTest("function a() { var arguments=[0]; return function b() { return arguments[0]; }}; var x = a()(1)", "test(x === 1)");
runTest("function foo() { var v0 = 0; try { throw 1 } catch(v0) { var v1 = v0 } return [v0, v1] } var x = foo();",
		"test(x[0] == 0 && x[1] == 1)");

runTest("for(var i = 0; i < 2; ++i) { break }", "test(i == 0)");
runTest("foo: for(var i = 0; i < 2; ++i) { break foo }", "test(i == 0)");

// Note: Different javascript interpreters disagree about this one.
runTest("function foo(){return 1;}" +
		"function bar(){if(false){function foo(){return 2}} return foo(); }" +
		"var x=bar()",
		"test_result(x);");

runTest("function foo(){return 1;}" +
		"function bar(){if(true){function foo(){return 2}} return foo(); }" +
		"var x=bar()",
		"test(x == 2);");

// Note: Different javascript interpreters disagree about this one.
runTest("function foo(){return 1;}" +
		"function bar(){if(false)function foo(){return 2} return foo(); }" +
		"var x=bar()",
		"test_result(x);");

runTest("function foo(){return 1;}" +
		"function bar(){if(true)function foo(){return 2} return foo(); }" +
		"var x=bar()",
		"test(x == 2);");

// Note: Different javascript interpreters disagree about this one.
runTest("function foo(){return 1;}" +
		"function bar(){return foo(); {function foo(){return 2}}}" +
		"var x=bar()",
		"test_result(x)");

runTest("function foo(){return 1;}" +
		"function bar(){{function foo(){return 2}} return foo(); }" +
		"var x=bar()",
		"test(x == 2)");

runTest("var x = 0.24567", "test(x == 0.24567)");
runTest("var x = {}; x.index = 5", "test(x.index == 5)");

// Konqueror doesn't like these tests. They are pretty wacky.

// var = '\
// !'
// (ie. line continuation followed by Unix newline)
runTest("var x = '\\\n!'", "test(x === '!')");

// var = '\
// !'
// (ie. line continuation followed by Mac newline)
runTest("var x = '\\\r!'", "test(x === '!')");

// var = '\
// !'
// (ie. line continuation followed by Windows newline)
runTest("var x = '\\\r\n!'", "test(x === '!')");

runTest("Number.prototype.flump = 3; var x = 1 .flump;", "test(x === 3)");

runTest("var x = 0; for(;;) { if(x === 2) break; ++x; }", "test(x === 2)");

runTest("var x = 0, y; for(y = (1 in [1,2]); y; y = false) { ++x; }", "test(x === 1)");

runTest("var x=[0];(function() { return x;})()[0] = 1", "test(x[0] == 1)");

runTest("var x=[0,1,2][1]", "test(x == 1)");
runTest("var x=[[0,1],[2,3],[4,5]][1][0]", "test(x == 2)");
runTest("var x=[[0,1],[2,3],[4,5]][1+1][1-1]", "test(x == 4)");

runTest("var x={'for':1,blah:2}","test(x['for']==1 && x.blah==2)");

runTest("function flump() { return 1; } function blah() { return flump(); { function flump() { return 2; } } } var x = blah();", "test_result(x)");
runTest("var x=0;while(x<1){goto\n:while(x<5){while(x<10){break goto;x+=10}x+=5}x+=1}", "test(x==1)"); 

runTest("function test() { var bang = {x:1}; (function bang() { bang.x = 2})(); return bang.x; } var x = test()", "test(x == 1)");

runTest("var o = {a:7, get b() {return this.a+1; }, set c(x) {this.a = x/2}};",
		"test(o.a == 7 && o.b == 8); o.c = 50; test(o.a == 25 && o.b == 26)");

runTest("var x = /([\"'\\f\\b\\n\\t\\r])/gm", "test_result(x.toString())");

runTest("var x = 0; do { ++x; } while(x < 2); ++x", "test(x == 3)");
runTest("var x = 0; if(true) { do { x = 1 } while(false); } else { x = 2 }", "test(x == 1)");

runTest("var x; const y = 0; with({y: 1}) { x = y }", "test(x === 1)");

/**/
print("Finished!");
