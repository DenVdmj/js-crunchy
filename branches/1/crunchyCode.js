var crunchyCode = 
"if(!Array.prototype.forEach) {\n" +
"    Array.prototype.forEach = function(f) {\n" +
"        for(var i = 0, j = this.length; i < j; ++i)\n" +
"            f(this[i]);\n" +
"    }\n" +
"}\n" +
"\n" +
"function crunchy(x) {\n" +
"    CompilerContext.prototype.ecmaStrictMode = true;\n" +
"    var parsed = parse(x);\n" +
"    var transformed = crunchy.transform(parsed);\n" +
"    parsed = null;\n" +
"    crunchy.rename(transformed);\n" +
"    return crunchy.write(transformed);\n" +
"}\n" +
"\n" +
"crunchy.error = function(x) {\n" +
"    console.error(x);\n" +
"}\n" +
"\n" +
";(function() {\n" +
"    // Quickly hacked together hash table which avoids clashes with\n" +
"    // Object.prototype, or default members such as the magnificant __proto__.\n" +
"    //\n" +
"    // Not suitable for general use ;)\n" +
"    crunchy.Hash = function() {\n" +
"        this.hash = {}\n" +
"    }\n" +
"\n" +
"    var chp = crunchy.Hash.prototype;\n" +
"\n" +
"    chp.prefix = '$crunchy$';\n" +
"    chp.prefixRegExp = /^[$]crunchy[$]/;\n" +
"\n" +
"    chp.genIndex = function(x) {\n" +
"        return this.prefix + x;\n" +
"    }\n" +
"\n" +
"    chp.isIndex = function(x) {\n" +
"        return this.prefixRegExp.test(x);\n" +
"    }\n" +
"\n" +
"    chp.removePrefix = function(x) {\n" +
"        return this.prefixRegExp.test(x) ?\n" +
"            x.replace(this.prefixRegExp, '') :\n" +
"            null;\n" +
"    }\n" +
"\n" +
"    chp.contains = function(x) {\n" +
"        return this.genIndex(x) in this.hash;\n" +
"    }\n" +
"\n" +
"    chp.get = function(x) {\n" +
"        return this.hash[this.genIndex(x)];\n" +
"    }\n" +
"\n" +
"    chp.set = function(x, y) {\n" +
"        return this.hash[this.genIndex(x)] = y;\n" +
"    }\n" +
"\n" +
"    chp.insert = function(x,y) {\n" +
"        var i = this.genIndex(x);\n" +
"        if(i in this.hash)\n" +
"            throw \"Duplicate insertion into crunchy.Hash: \" + x;\n" +
"        else\n" +
"            this.hash[i] = y;\n" +
"        return y;\n" +
"    }\n" +
"\n" +
"    chp.forEach = function(f) {\n" +
"        for(var i in this.hash) {\n" +
"            var i2 = this.removePrefix(i);\n" +
"            if(i2) f(i2, this.hash[i]);\n" +
"        }\n" +
"    }\n" +
"\n" +
"    // Quickly hacked together hash table for associating a key with\n" +
"    // multiple values.\n" +
"    //\n" +
"    // Not suitable for general use ;)\n" +
"    // Terrible use of inheritance, I should be ashamed.\n" +
"\n" +
"    crunchy.MultiHash = function() { crunchy.Hash.apply(this) };\n" +
"    var cmp = crunchy.MultiHash.prototype;\n" +
"    for(var i in chp)\n" +
"        if(i != 'set') cmp[i] = chp[i];\n" +
"\n" +
"    cmp.insert = function(x,y) {\n" +
"        var i = this.genIndex(x);\n" +
"        if(i in this.hash)\n" +
"            this.hash[i].push(y);\n" +
"        else\n" +
"            this.hash[i] = [y];\n" +
"        return y;\n" +
"    }\n" +
"})();\n" +
"\n" +
";(function() {\n" +
"    // Build up data arrays of characters to be used for generating variable\n" +
"    // names.\n" +
"\n" +
"    function addChars(first, last, array) {\n" +
"        for(var i = first.charCodeAt(0), j = last.charCodeAt(0); i <= j; ++i)\n" +
"            array.push(String.fromCharCode(i));\n" +
"    }\n" +
"\n" +
"    var chars1 = [];\n" +
"    addChars('a', 'z', chars1);\n" +
"    addChars('A', 'Z', chars1);\n" +
"    var chars2 = chars1;\n" +
"    addChars('0', '9', chars2);\n" +
"\n" +
"    function genName(x) {\n" +
"        var name = chars1[x % chars1.length];\n" +
"        x = x / chars1.length - 1;\n" +
"        if(x >= 0) {\n" +
"            name += chars2[x % chars2.length];\n" +
"            x = x / chars2.length - 1;\n" +
"            if(x >= 0) {\n" +
"                name += chars2[x % chars2.length];\n" +
"            }\n" +
"            else {\n" +
"                throw \"Out of character ids!\";\n" +
"            }\n" +
"        }\n" +
"\n" +
"        return name;\n" +
"    }\n" +
"\n" +
"    // Rename the variables from root.\n" +
"\n" +
"    crunchy.rename = function(root) {\n" +
"        var s = root.scopeList;\n" +
"\n" +
"        if(!s) {\n" +
"            crunchy.error(\"renameVariables called for node without a scope list.\");\n" +
"            return;\n" +
"        }\n" +
"\n" +
"        var variables = [], fixed = new crunchy.MultiHash;\n" +
"        for(var i = 0; i < s.length; ++i) {\n" +
"            s[i].decls.forEach(function(name, v) {\n" +
"                if(v.fixed) {\n" +
"                    fixed.insert(name, v);\n" +
"                }\n" +
"                else {\n" +
"                    v.oldName = v.name;\n" +
"                    delete v.name;\n" +
"                    v.mark = -1;\n" +
"                    variables.push(v);\n" +
"                }\n" +
"            });\n" +
"        }\n" +
"\n" +
"        for(var id = 0; variables.length > 0; ++id) {\n" +
"            var newName = genName(id);\n" +
"\n" +
"            function markClashes(scopes) {\n" +
"                for(var i = 0; i < scopes.length; ++i) {\n" +
"                    scopes[i].decls.forEach(function(index, value){\n" +
"                        value.mark = id;\n" +
"                    });\n" +
"                    scopes[i].refs.forEach(function(index, value){\n" +
"                        value.mark = id;\n" +
"                    });\n" +
"                }\n" +
"            }\n" +
"\n" +
"            if(fixed.contains(newName)) {\n" +
"                fixed.get(newName).forEach(function(x) {\n" +
"                    markClashes(x.scopes);\n" +
"                });\n" +
"            }\n" +
"\n" +
"            var i = 0;\n" +
"            while(i < variables.length) {\n" +
"                if(!variables[i].name && variables[i].mark != id) {\n" +
"                    variables[i].name = newName;\n" +
"                    markClashes(variables[i].scopes);\n" +
"                    variables.splice(i, 1);\n" +
"                }\n" +
"                else {\n" +
"                    ++i;\n" +
"                }\n" +
"            }\n" +
"        }\n" +
"        console.log(\"#Ids: \" + id);\n" +
"    }\n" +
"})();\n" +
"\n" +
";(function() {\n" +
"    // Code transformation hooks\n" +
"\n" +
"    // A simple one to start of with. If a loop body ends with 'continue' then\n" +
"    // remove it. Mainly intended for something like:\n" +
"    //    while(foo(x)) continue;\n" +
"    // Be carefuly not to remove continue if it has a label.\n" +
"    // TODO: Maybe remove for:\n" +
"    //    bar: while(...) { ...; continue bar; }\n" +
"\n" +
"    function trim_loop_body(loop) {\n" +
"        var last = loop.body.top();\n" +
"        if(last &&\n" +
"            last.type == CONTINUE &&\n" +
"            !last.label) {\n" +
"            --loop.body.length;\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function combine_vars(func) {\n" +
"        var i = 0, last = false;\n" +
"        while(i < func.body.length) {\n" +
"            var is_var = func.body[i].type == VAR;\n" +
"            if(is_var && last) {\n" +
"                func.body[i].operands = func.body[i-1].operands.concat(func.body[i].operands);\n" +
"                func.body.splice(i-1, 1);\n" +
"            }\n" +
"            else if(func.body[i].type == FOR && func.body[i].setup.type == VAR && last) {\n" +
"                func.body[i].setup.operands = func.body[i-1].operands.concat(func.body[i].setup.operands);\n" +
"                func.body.splice(i-1, 1);\n" +
"            }\n" +
"            else {\n" +
"                ++i;\n" +
"            }\n" +
"            last = is_var;\n" +
"        }\n" +
"    }\n" +
"\n" +
"    // The hooks, transformations should probably be setup dynamically from\n" +
"    // the options used with crunchy.\n" +
"\n" +
"    var transformations = {}\n" +
"    transformations[FOR_IN] = [ trim_loop_body ];\n" +
"    transformations[FOR] = [ trim_loop_body ];\n" +
"    transformations[WHILE] = [ trim_loop_body ];\n" +
"    transformations[DO] = [ trim_loop_body ];\n" +
"    transformations[FUNCTION] = [ combine_vars ];\n" +
"\n" +
"    crunchy.hooks = function(node) {\n" +
"        var t = transformations[node.type];\n" +
"        if(t) {\n" +
"            for(var i = 0; i < t.length; ++i)\n" +
"                t[i](node);\n" +
"        }\n" +
"    }\n" +
"})()\n" +
"\n" +
";(function() {\n" +
"    // TODO: This means that crunchy.transform isn't reentrant. Do I care?\n" +
"    // Well, it means that it can't be called from the transform hooks.\n" +
"    var topScope, scopeList;\n" +
"\n" +
"    crunchy.transform = function(x) {\n" +
"        // This scope is the global scope, so set it to mutable as we cannot\n" +
"        // tell what it contains.\n" +
"        scopeList = [];\n" +
"\n" +
"        topScope = new Scope(topScope,true);\n" +
"        var root = new MyNode(false, SCRIPT);\n" +
"        root.scope = topScope;\n" +
"        root.statements = statement(x);        \n" +
"        root.scopeList = scopeList;\n" +
"\n" +
"        crunchy.hooks(root);\n" +
"\n" +
"        return root;\n" +
"    }\n" +
"\n" +
"    // Scopes\n" +
"\n" +
"    function ScopeVar(name, scope) {\n" +
"        if(!(scope instanceof Scope))\n" +
"            console.error(\"Creating ScopeVar without scope.\");\n" +
"        this.name = name;\n" +
"        this.scopes = [scope];\n" +
"        this.fixed = scope.mutable;\n" +
"    }\n" +
"\n" +
"    function Scope(parent, mutable) {\n" +
"        this.parent = topScope;\n" +
"        this.mutable = mutable;\n" +
"        this.decls = new crunchy.Hash;\n" +
"        this.refs = new crunchy.Hash;\n" +
"        scopeList.push(this);\n" +
"    }\n" +
"\n" +
"    function withScope(mutable, func) {\n" +
"        topScope = new Scope(topScope, mutable);\n" +
"        try {\n" +
"            func();\n" +
"            return topScope;\n" +
"        }\n" +
"        finally {\n" +
"            topScope = topScope.parent;\n" +
"        }\n" +
"    }\n" +
"\n" +
"    Scope.prototype.setVars = function(parsed) {\n" +
"        var decls = this.decls;\n" +
"        var scope = this;\n" +
"\n" +
"        function addVar(node) {\n" +
"            if(!decls.contains(node.name)) {\n" +
"                decls.insert(node.name,\n" +
"                    new ScopeVar(node.name, scope));\n" +
"            }\n" +
"        }\n" +
"\n" +
"        parsed.varDecls.forEach(addVar);\n" +
"        parsed.funDecls.forEach(addVar);\n" +
"    }\n" +
"\n" +
"    Scope.prototype.setParams = function(p) {\n" +
"        var result = [];\n" +
"        for(var i = 0; i < p.length; ++i) {\n" +
"            var x = new ScopeVar(p[i], this);\n" +
"            result[i] = x;\n" +
"            this.decls.insert(p[i], x);\n" +
"        }\n" +
"        return result;\n" +
"    }\n" +
"\n" +
"    Scope.prototype.refVar = function(name) {\n" +
"        var x = this.decls.get(name) || this.refs.get(name);\n" +
"        if(!x) {\n" +
"            if (this.parent) {\n" +
"                x = this.refs.insert(name, this.parent.refVar(name));\n" +
"                x.scopes.push(this);\n" +
"                x.fixed = x.fixed || this.mutable;\n" +
"            }\n" +
"            else {\n" +
"                x = this.decls.insert(name, new ScopeVar(name, this));\n" +
"            }\n" +
"        }\n" +
"        return x;\n" +
"    }\n" +
"\n" +
"    Scope.prototype.setMutable = function() {\n" +
"        for(var i in this.decls) this.decls[i].fixed = true;\n" +
"        for(var i in this.refs) this.refs[i].fixed = true;\n" +
"    }\n" +
"\n" +
"    // Nodes\n" +
"\n" +
"    function MyNode(parsed, type) {\n" +
"        this.parsed = parsed;\n" +
"        this.type = type ? type : parsed.type;\n" +
"    }\n" +
"\n" +
"    MyNode.prototype._value = function(name) {\n" +
"        this[name] = this.parsed[name];\n" +
"    }\n" +
"\n" +
"    MyNode.prototype._statement = function(name) {\n" +
"        if(!this.parsed[name])\n" +
"            crunchy.error(\"Statement missing: \" + name);\n" +
"        else\n" +
"            this[name] = statement(this.parsed[name]);\n" +
"    }\n" +
"\n" +
"    MyNode.prototype._expression = function(name) {\n" +
"        if(!this.parsed[name])\n" +
"            crunchy.error(\"Expression missing: \" + name);\n" +
"        else\n" +
"            this[name] = expression(this.parsed[name]);\n" +
"    }\n" +
"\n" +
"    MyNode.prototype.optionalValue = function(name) {\n" +
"        if(this.parsed[name]) this[name] = this.parsed[name];\n" +
"    }\n" +
"\n" +
"    MyNode.prototype.optionalStatement = function(name) {\n" +
"        if(this.parsed[name]) this[name] = statement(this.parsed[name]);\n" +
"    }\n" +
"\n" +
"    MyNode.prototype.optionalExpression = function(name) {\n" +
"        if(isObject(this.parsed[name])) this[name] = expression(this.parsed[name]);\n" +
"    }\n" +
"\n" +
"    MyNode.prototype.optionalExpressionVar = function(name) {\n" +
"        if(isObject(this.parsed[name])) this[name] = expression_or_var(this.parsed[name]);\n" +
"    }\n" +
"\n" +
"    MyNode.prototype.optionalVar = function(name) {\n" +
"        if(isObject(this.parsed[name])) this[name] = var_(this.parsed[name]);\n" +
"    }\n" +
"\n" +
"    MyNode.prototype._operands = function(member) {\n" +
"        this.operands = [];\n" +
"        for(var i = 0; i < this.parsed.length; ++i) {\n" +
"            this.operands[i] = expression(this.parsed[i],\n" +
"                !isUndefined(member) && i == member);\n" +
"            //this._expression(i);\n" +
"        }\n" +
"    }\n" +
"\n" +
"    MyNode.prototype.toString = function () {\n" +
"        var a = [];\n" +
"        for (var i in this) {\n" +
"            if (this.hasOwnProperty(i) && i != 'type' && i != 'parsed')\n" +
"                a.push({id: i, value: this[i]});\n" +
"        }\n" +
"        a.sort(function (a,b) { return (a.id < b.id) ? -1 : 1; });\n" +
"        var INDENTATION = \"    \";\n" +
"        var n = ++Node.indentLevel;\n" +
"        var s = \"{\\n\" + INDENTATION.repeat(n) + \"type: \" + tokenstr(this.type);\n" +
"        for (i = 0; i < a.length; i++) {\n" +
"            s += \",\\n\" + INDENTATION.repeat(n) + a[i].id + \": \" + a[i].value;\n" +
"        }\n" +
"        n = --Node.indentLevel;\n" +
"        s += \"\\n\" + INDENTATION.repeat(n) + \"}\";\n" +
"        return s;\n" +
"    }\n" +
"\n" +
"    // The actual work is done here:\n" +
"\n" +
"    function statement(parsed) {\n" +
"        var nodes = statement2(parsed);\n" +
"\n" +
"        for(var i = 0; i < nodes.length; ++i)\n" +
"            crunchy.hooks(nodes[i]);\n" +
"\n" +
"        return nodes;\n" +
"    }\n" +
"\n" +
"    function statement2(parsed) {\n" +
"        if(!parsed) {\n" +
"            crunchy.error(\"Null Statement.\");\n" +
"            return [];\n" +
"        }\n" +
"\n" +
"        var result = new MyNode(parsed);\n" +
"        switch(parsed.type) {\n" +
"        case SCRIPT:\n" +
"            topScope.setVars(parsed);\n" +
"            // Fall through...\n" +
"        case BLOCK:\n" +
"            var nodes = [];\n" +
"            for(var i = 0; i < parsed.length; ++i) {\n" +
"                nodes = nodes.concat(statement(parsed[i]));\n" +
"            }\n" +
"            return nodes;\n" +
"        case FUNCTION:\n" +
"            // TODO: type == GETTER/SETTER\n" +
"            // TODO: functionForm?\n" +
"            //result.optionalValue('name');\n" +
"            if(parsed.name) result.name = topScope.refVar(parsed.name);\n" +
"            result.scope = withScope(false, function() {\n" +
"                // TODO: Register this with result?\n" +
"                result.params = topScope.setParams(parsed.params);\n" +
"                result._statement('body');\n" +
"            });\n" +
"            return [result];\n" +
"        case IF:\n" +
"            result._expression('condition');\n" +
"            result._statement('thenPart');\n" +
"            result.optionalStatement('elsePart');\n" +
"            return [result];\n" +
"        case SWITCH:\n" +
"            result._expression('discriminant');\n" +
"            result._value('defaultIndex'); // Not really needed?\n" +
"            var cases = [];\n" +
"            for(var i = 0; i < parsed.cases.length; ++i) {\n" +
"                var case_ = statement(parsed.cases[i]);\n" +
"                if(case_.length != 1)\n" +
"                    crunchy.error(\"Multiple statements for switch case.\");\n" +
"                cases = cases.concat(case_);\n" +
"            }\n" +
"            // TODO: Register cases with result.\n" +
"            result.cases = cases;\n" +
"            return [result];\n" +
"        case CASE:\n" +
"            result._expression('caseLabel');\n" +
"            // Fall through.\n" +
"        case DEFAULT:\n" +
"            result._statement('statements');\n" +
"            return [result];\n" +
"        case FOR:\n" +
"            result.isLoop = true;\n" +
"            result.optionalExpressionVar('setup');\n" +
"            result.optionalExpression('condition');\n" +
"            result.optionalExpression('update');\n" +
"            result._statement('body');\n" +
"            return [result];\n" +
"        case WHILE:\n" +
"            result.isLoop = true;\n" +
"            result.optionalExpression('condition');\n" +
"            result._statement('body');\n" +
"            return [result];\n" +
"        case FOR_IN:\n" +
"            result.isLoop = true;\n" +
"            result.optionalVar('varDecl');\n" +
"            result._expression('iterator');\n" +
"            result._expression('object');\n" +
"            result._statement('body');\n" +
"            return [result];\n" +
"        case DO:\n" +
"            result.isLoop = true;\n" +
"            result._statement('body');\n" +
"            result.optionalExpression('condition');\n" +
"            return [result];\n" +
"        case BREAK:\n" +
"        case CONTINUE:\n" +
"            // TODO: Ignoring parsed.target, but could use to rename labels.\n" +
"            result.optionalValue('label');\n" +
"            return [result];\n" +
"        case TRY:\n" +
"            result._statement('tryBlock');\n" +
"            var catchClauses = [];\n" +
"            for(var i = 0; i < parsed.catchClauses.length; ++i) {\n" +
"                var catch_ = statement(parsed.catchClauses[i]);\n" +
"                if(catch_.length != 1)\n" +
"                    catch_.error(\"Multiple statements for catch.\");\n" +
"                catchClauses = catchClauses.concat(catch_);\n" +
"            }\n" +
"            // TODO: Register catchClauses with result.\n" +
"            result.catchClauses = catchClauses;\n" +
"            result.optionalStatement('finallyBlock');\n" +
"            return [result];\n" +
"        case CATCH:\n" +
"            result._value('varName');\n" +
"            result.optionalExpression('guard');\n" +
"            result._statement('block');\n" +
"            return [result];\n" +
"        case THROW:\n" +
"            result._expression('exception');\n" +
"            return [result];\n" +
"        case RETURN:\n" +
"            result.optionalExpression('value');\n" +
"            return [result];\n" +
"        case WITH:\n" +
"            result._expression('object');\n" +
"            result.scope = withScope(true, function() {\n" +
"                result._statement('body');\n" +
"            });\n" +
"            return [result];\n" +
"        case VAR:\n" +
"        case CONST:\n" +
"            return [var_(parsed)];\n" +
"        case DEBUGGER:\n" +
"            return [result]\n" +
"        case SEMICOLON:\n" +
"            result.optionalExpression('expression');\n" +
"            if(result.expression) {\n" +
"                // TODO: Could just return the expression?\n" +
"                return [result];\n" +
"            }\n" +
"            else {\n" +
"                // TODO: Could use this to detect debugging statements.\n" +
"                // Maybe by looking back at the original text?\n" +
"                return [];\n" +
"            }\n" +
"        case LABEL:\n" +
"            result._value('label');\n" +
"            result._statement('statement');\n" +
"            return [result];\n" +
"        default:\n" +
"            crunchy.error(\"Unrecognized parse node type: \" + tokenstr(parsed.type));\n" +
"            return []\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function expression_or_var(x) {\n" +
"        return x.type == VAR || x.type == CONST ?\n" +
"            var_(x) : expression(x);\n" +
"    }\n" +
"\n" +
"    function expression(parsed, member) {\n" +
"        switch(parsed.type) {\n" +
"        case GROUP:\n" +
"            return expression(parsed[0]);\n" +
"        case FUNCTION:\n" +
"            // TODO: Move FUNCTION into its own function?\n" +
"            return statement(parsed)[0];\n" +
"        case IDENTIFIER:\n" +
"            var result = new MyNode(parsed);\n" +
"            result._value('value');\n" +
"            if(!member) {\n" +
"                result.ref = topScope.refVar(parsed.value);\n" +
"            }\n" +
"            return result;\n" +
"        case EMPTY:\n" +
"            return new MyNode(parsed);\n" +
"        case NULL: case THIS: case TRUE: case FALSE:\n" +
"        case NUMBER: case STRING: case REGEXP:\n" +
"            var result = new MyNode(parsed);\n" +
"            result._value('value');\n" +
"            return result;\n" +
"        case CALL:\n" +
"            // Calls to eval can add variables, so any variable reference in\n" +
"            // this scope are at risk, and their names must be fixed.\n" +
"            //\n" +
"            // There are tons of cases that this doesn't catch but I think it\n" +
"            // would be impossible to deal with them all. I can't even detect:\n" +
"            //     window.eval('var x = 1');\n" +
"            if(!member && parsed[0].type == IDENTIFIER && parsed[0].value == 'eval')\n" +
"                topScope.setMutable();\n" +
"            // Fall through\n" +
"        case CONDITIONAL:\n" +
"        case NEW_WITH_ARGS: case LIST:\n" +
"        case INDEX:\n" +
"        case OBJECT_INIT: case ARRAY_INIT:\n" +
"        case COMMA: case OR: case AND:\n" +
"        case BITWISE_OR: case BITWISE_XOR: case BITWISE_AND:\n" +
"        case EQ: case NE: case STRICT_EQ: case STRICT_NE:\n" +
"        case LT: case LE: case GE: case GT:\n" +
"        case IN: case INSTANCEOF:\n" +
"        case LSH: case RSH: case URSH:\n" +
"        case PLUS: case MINUS: case MUL: case DIV: case MOD:\n" +
"        case NEW: case INCREMENT: case DECREMENT:\n" +
"        case DELETE: case VOID: case TYPEOF:\n" +
"        case NOT: case BITWISE_NOT: case UNARY_MINUS:\n" +
"            var result = new MyNode(parsed);\n" +
"            result.optionalValue('postfix');\n" +
"            result._operands();\n" +
"            return result;\n" +
"        case ASSIGN:\n" +
"            var result = new MyNode(parsed);\n" +
"            // TODO: This sucks so much.\n" +
"            if(parsed[0].assignOp) {\n" +
"                result.assignOp = parsed[0].assignOp;\n" +
"            }\n" +
"            result.optionalValue('postfix');\n" +
"            result._operands();\n" +
"            return result;\n" +
"        case UNARY_PLUS:\n" +
"            var result = new MyNode(parsed);\n" +
"            result.optionalValue('postfix');\n" +
"            result._operands();\n" +
"\n" +
"            // TODO: Yet another horrid hack....\n" +
"            if(result.operands.length != 1) {\n" +
"                crunch.error(\"Unary plus doesn't have 1 operand.\");\n" +
"                return result;\n" +
"            }\n" +
"            else {\n" +
"                return result.operands[0];\n" +
"            }\n" +
"        case PROPERTY_INIT:\n" +
"            // Need to remember that we're after the dot operator so that\n" +
"            // identifiers aren't variables. Other cases?\n" +
"            var result = new MyNode(parsed);\n" +
"            result._operands(0);\n" +
"            return result;\n" +
"        case DOT:\n" +
"            // Need to remember that we're after the dot operator so that\n" +
"            // identifiers aren't variables. Other cases?\n" +
"            var result = new MyNode(parsed);\n" +
"            result._operands(1);\n" +
"            return result;\n" +
"        default:\n" +
"            crunchy.error(\"Transform: Unrecognized expression node type: \" + tokenstr(parsed.type));\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function var_(parsed) {\n" +
"        var result = new MyNode(parsed);\n" +
"        result._operands();\n" +
"        for(var i = 0; i < parsed.length; ++i) {\n" +
"            if(result.operands[i].type != IDENTIFIER) {\n" +
"                crunchy.error(\"Non-identifier in var: \" + tokenstr(result.operands[i].type));\n" +
"            }\n" +
"            else {\n" +
"                result.operands[i].optionalExpression('initializer');\n" +
"            }\n" +
"        }\n" +
"        return result;\n" +
"    }\n" +
"})();\n" +
"\n" +
"\n" +
"crunchy.write = function(x) {\n" +
"    var prev = null;\n" +
"    var result = [];\n" +
"    var invalidOps = {};\n" +
"\n" +
"    var ended = true;\n" +
"    var needEnd = false;\n" +
"\n" +
"    write_statement(x);\n" +
"    return result.join('');\n" +
"\n" +
"    function addInvalidOp(op, func) {\n" +
"        var old = invalidOps;\n" +
"        invalidOps = {};\n" +
"        for(var i in op) { invalidOps[i] = op[i]; }\n" +
"        invalidOps[op] = true;\n" +
"        try {\n" +
"            func.apply(this);\n" +
"        } finally {\n" +
"            invalidOps = old;\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function clearInvalidOps(func) {\n" +
"        var old = invalidOps;\n" +
"        invalidOps = {};\n" +
"        try {\n" +
"            func.apply(this);\n" +
"        } finally {\n" +
"            invalidOps = old;\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function write() {\n" +
"        if(needEnd) {\n" +
"            if(opTypeNames[arguments[0]]) {\n" +
"                result.push(';'); prev = ';';\n" +
"            }\n" +
"            else {\n" +
"                result.push('\\n'); prev = '\\n';\n" +
"            }\n" +
"            needEnd = false;\n" +
"            ended = true;\n" +
"        }\n" +
"\n" +
"        ended = false;\n" +
"\n" +
"        for(var i = 0; i < arguments.length; ++i) {\n" +
"            token = String(arguments[i]);\n" +
"\n" +
"            if(prev) {\n" +
"                switch(prev) {\n" +
"                case '+':\n" +
"                    if(token.charAt(0) == '+')\n" +
"                        result.push(' ');\n" +
"                    break;\n" +
"                case '-':\n" +
"                    if(token.charAt(0) == '-')\n" +
"                        result.push(' ');\n" +
"                    break;\n" +
"                default:\n" +
"                    if(/[a-zA-Z0-9_$]$/.test(prev) &&\n" +
"                        /^[a-zA-Z0-9_$]/.test(token))\n" +
"                        result.push(' ');\n" +
"                    break;\n" +
"                }\n" +
"            }\n" +
"            result.push(token);\n" +
"            prev = token;\n" +
"        }\n" +
"    }\n" +
"\n" +
"    // TODO: This is such a nasty hack...\n" +
"    function write_exp_function() {\n" +
"        if(ended) {\n" +
"            result.push('+'); prev = '+';\n" +
"            ended = false;\n" +
"        }\n" +
"        else if(needEnd) {\n" +
"            result.push(';', '+'); prev = '+';\n" +
"            needEnd = false;\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function endStatement() {\n" +
"        ended = true;\n" +
"    }\n" +
"\n" +
"    function seperateStatement() {\n" +
"        if(!ended) {\n" +
"            if(true) {\n" +
"                write(';');\n" +
"            }\n" +
"            else {\n" +
"                // TODO: When is it safe to use a newline? It's tricky - it's\n" +
"                // often not safe when the next line starts with a\n" +
"                // pre-increment. Any other cases?\n" +
"                needEnd = true;\n" +
"            }\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function writeStatements(statements) {\n" +
"        for(var i = 0; i < statements.length; ++i) {\n" +
"            if(i != 0) seperateStatement();\n" +
"            write_statement(statements[i]);\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function write_statement(s) {\n" +
"        if(invalidOps[IF] && s.type == IF && !s.elsePart) {\n" +
"            write_block([s], true);\n" +
"        }\n" +
"        else {\n" +
"            write_statement2(s);\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function write_statement2(s) {\n" +
"        switch(s.type) {\n" +
"        case SCRIPT:\n" +
"            writeStatements(s.statements);\n" +
"            break;\n" +
"        case FUNCTION:\n" +
"            write('function');\n" +
"            if(s.name) write(s.name.name);\n" +
"            write('(');\n" +
"            for(var i = 0; i < s.params.length; ++i) {\n" +
"                if(i != 0) write(',');\n" +
"                write(s.params[i].name);\n" +
"            }\n" +
"            write(')');\n" +
"            write_block(s.body, true);\n" +
"            break;\n" +
"        case IF:\n" +
"            write('if');\n" +
"            write_bracketed(s.condition, '(', ')');\n" +
"            addInvalidOp(IF, function() {\n" +
"                write_block(s.thenPart, false);\n" +
"            });\n" +
"            if(s.elsePart) {\n" +
"                seperateStatement();\n" +
"                write('else');\n" +
"                write_block(s.elsePart, false);\n" +
"            }\n" +
"            break;\n" +
"        case SWITCH:\n" +
"            write('switch');\n" +
"            write_bracketed(s.discriminant, '(', ')');\n" +
"            write('{');\n" +
"            for(var i = 0; i < s.cases.length; ++i) {\n" +
"                if(i != 0) seperateStatement();\n" +
"                switch(s.cases[i].type) {\n" +
"                case CASE:\n" +
"                    write('case');\n" +
"                    write_expression(s.cases[i].caseLabel);\n" +
"                    write(':');\n" +
"                    endStatement();\n" +
"                    break;\n" +
"                case DEFAULT:\n" +
"                    write('default', ':');\n" +
"                    endStatement();\n" +
"                    break;\n" +
"                default:\n" +
"                    crunchy.error(\"Unrecognized switch clause: \" +\n" +
"                        strToken(s.cases[i].type));\n" +
"                    break;\n" +
"                }\n" +
"                writeStatements(s.cases[i].statements);\n" +
"            }\n" +
"            write('}');\n" +
"            endStatement();\n" +
"            break;\n" +
"        case FOR:\n" +
"            write('for','(');\n" +
"            if(s.setup) addInvalidOp('IN', function() {\n" +
"                write_expression_or_var(s.setup);\n" +
"            });\n" +
"            write(';');\n" +
"            if(s.condition)write_expression(s.condition);\n" +
"            write(';');\n" +
"            if(s.update)write_expression(s.update);\n" +
"            write(')');\n" +
"            write_block(s.body);\n" +
"            break;\n" +
"        case FOR_IN:\n" +
"            write('for','(');\n" +
"            addInvalidOp('IN', function() {\n" +
"                if(s.varDecl)\n" +
"                    write_var(s.varDecl);\n" +
"                else\n" +
"                    write_expression(s.iterator);\n" +
"            });\n" +
"            write('in');\n" +
"            write_expression(s.object);\n" +
"            write(')');\n" +
"            write_block(s.body);\n" +
"            break;\n" +
"        case WHILE:\n" +
"            write('while','(');\n" +
"            write_expression(s.condition);\n" +
"            write(')');\n" +
"            write_block(s.body);\n" +
"            break;\n" +
"        case DO:\n" +
"            // TODO: When writing out do..while, can possibly omit semi-colon or\n" +
"            // newline following while(), see:\n" +
"            // https://bugzilla.mozilla.org/show_bug.cgi?id=238945\n" +
"\n" +
"            write('do');\n" +
"            write_block(s.body);\n" +
"            seperateStatement();\n" +
"            write('while','(');\n" +
"            write_expression(s.condition);\n" +
"            write(')');\n" +
"            break;\n" +
"        case BREAK:\n" +
"        case CONTINUE:\n" +
"            write(s.type == BREAK ? 'break' : 'continue');\n" +
"            if(s.label) write(s.label);\n" +
"            break;\n" +
"        case TRY:\n" +
"            write('try');\n" +
"            write_block(s.tryBlock, true);\n" +
"            for(var i = 0; i < s.catchClauses.length; ++i) {\n" +
"                write('catch','(',s.catchClauses[i].varName);\n" +
"                if(s.catchClauses[i].guard) {\n" +
"                    write('if');\n" +
"                    write_expression(s.catchClauses[i].guard);\n" +
"                }\n" +
"                write(')');\n" +
"                write_block(s.catchClauses[i].block, true);\n" +
"            }\n" +
"            if(s.finallyBlock) {\n" +
"                write('finally');\n" +
"                write_block(s.finallyBlock, true);\n" +
"            }\n" +
"            break;\n" +
"        case THROW:\n" +
"            write('throw');\n" +
"            write_expression(s.exception);\n" +
"            break;\n" +
"        case RETURN:\n" +
"            write('return');\n" +
"            if(s.value) write_expression(s.value);\n" +
"            break;\n" +
"        case WITH:\n" +
"            write('with','(');\n" +
"            write_expression(s.object);\n" +
"            write(')');\n" +
"            write_block(s.body);\n" +
"            break;\n" +
"        case VAR:\n" +
"        case CONST:\n" +
"            write_var(s);\n" +
"            break;\n" +
"        case DEBUGGER:\n" +
"            write('debugger');\n" +
"            break;\n" +
"        case SEMICOLON:\n" +
"            // Transformation is meant to remove empty semicolons.\n" +
"            if(!s.expression)\n" +
"                crunchy.error(\"Empty semicolon\");\n" +
"            else {\n" +
"                write_expression(s.expression);\n" +
"            }\n" +
"            break;\n" +
"        case LABEL:\n" +
"            write(s.label,':');\n" +
"            write_block(s.statement);\n" +
"            break;\n" +
"        default:\n" +
"            crunchy.error(\"Unrecognized statement node type: \" + tokenstr(s.type));\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function write_expression_or_var(e) {\n" +
"        return e.type == VAR || e.type == CONST ? write_var(e) :\n" +
"            write_expression(e);\n" +
"    }\n" +
"\n" +
"    function write_bracketed(es, open, close) {\n" +
"        clearInvalidOps(function() {\n" +
"            write(open);\n" +
"            if(isArray(es)) {\n" +
"                for(var i = 0; i < es.length; ++i) {\n" +
"                    if(i != 0) write(',');\n" +
"                    // Note: Could just set the precedence to opPrecedence[COMMA] + 1.\n" +
"                    addInvalidOp(COMMA, function() {\n" +
"                        write_expression(es[i]);\n" +
"                    });\n" +
"                }\n" +
"            }\n" +
"            else {\n" +
"                write_expression(es);\n" +
"            }\n" +
"            write(close);\n" +
"        });\n" +
"    }\n" +
"\n" +
"    function write_expression(e, precedence) {\n" +
"        precedence = precedence || 0;\n" +
"\n" +
"        if(invalidOps[e.type]) {\n" +
"            clearInvalidOps(function() {\n" +
"                write_bracketed(e, '(', ')');\n" +
"            });\n" +
"        }\n" +
"        else {\n" +
"            write_expression2(e, precedence);\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function write_expression2(e, precedence) {\n" +
"        var op = tokens[e.type].toLowerCase();\n" +
"        switch(e.type) {\n" +
"        case FUNCTION:\n" +
"            // TODO: Clean this up...\n" +
"\n" +
"            // Need to disambiguate between an expression function and a\n" +
"            // statement expression.\n" +
"            write_exp_function();\n" +
"            write_statement(e);\n" +
"\n" +
"            // The statement code will think that the function ends the\n" +
"            // statement but it doesn't.\n" +
"            ended = false;\n" +
"            break;\n" +
"        case EMPTY:\n" +
"            break;\n" +
"        case IDENTIFIER:\n" +
"            write(e.ref ? e.ref.name : e.value);\n" +
"            break;\n" +
"        case NULL: case THIS: case TRUE: case FALSE:\n" +
"        case NUMBER: case REGEXP:\n" +
"            write(e.value);\n" +
"            break;\n" +
"        case STRING:\n" +
"            write(crunchy.stringEscape(e.value));\n" +
"            break;\n" +
"        case CONDITIONAL:\n" +
"            clearInvalidOps(function() {\n" +
"                if(precedence > opPrecedence[CONDITIONAL])\n" +
"                    write('(');\n" +
"                write_expression(e.operands[0],\n" +
"                        e.operands[0].type == ASSIGN ? opPrecedence[ASSIGN]+1 :\n" +
"                        opPrecedence[CONDITIONAL]);\n" +
"                write('?');\n" +
"                write_expression(e.operands[1], opPrecedence[CONDITIONAL]);\n" +
"                write(':');\n" +
"                write_expression(e.operands[2], opPrecedence[CONDITIONAL]);\n" +
"                if(precedence > opPrecedence[CONDITIONAL])\n" +
"                    write(')');\n" +
"            });\n" +
"            break;\n" +
"        case NEW_WITH_ARGS:\n" +
"        case CALL:\n" +
"            // Precedence?\n" +
"            if(e.type == NEW_WITH_ARGS) write('new');\n" +
"            write_expression(e.operands[0], opPrecedence[DOT]);\n" +
"            if(e.operands[1].type != LIST) {\n" +
"                crunchy.error(\"Suprise operand type for CALL.\");\n" +
"                write_bracketed([], '(', ')');\n" +
"            }\n" +
"            else {\n" +
"                write_bracketed(e.operands[1].operands, '(', ')');\n" +
"            }\n" +
"            break;\n" +
"        case INDEX:\n" +
"            write_expression(e.operands[0]);\n" +
"            write('[');\n" +
"            write_expression(e.operands[1]);\n" +
"            write(']');\n" +
"            break;\n" +
"        case OBJECT_INIT:\n" +
"            write_bracketed(e.operands, '{', '}');\n" +
"            // TODO: A semi-colon is required after an object that ends a statement.\n" +
"            break;\n" +
"        case PROPERTY_INIT: // TODO: Is this an expression?\n" +
"            console.log(e.operands[0].type);\n" +
"            if(e.operands[0].type == STRING &&\n" +
"                /^[a-zA-Z$_][a-zA-Z0-9$_]*$/.test(e.operands[0].value) &&\n" +
"                !lookupKeyword(e.operands[0].value))\n" +
"            {\n" +
"                write(e.operands[0].value);\n" +
"            }\n" +
"            else\n" +
"            {\n" +
"                write_expression(e.operands[0]);\n" +
"            }\n" +
"            write(':');\n" +
"            write_expression(e.operands[1]);\n" +
"            break;\n" +
"        case ARRAY_INIT:\n" +
"            write_bracketed(e.operands, '[', ']');\n" +
"            // TODO: A semi-colon is required after an object that ends a statement.\n" +
"            break;\n" +
"        case ASSIGN:\n" +
"            if(e.assignOp)\n" +
"                op = tokens[e.assignOp] + op;\n" +
"        case COMMA: case OR: case AND:\n" +
"        case BITWISE_OR: case BITWISE_XOR: case BITWISE_AND:\n" +
"        case EQ: case NE: case STRICT_EQ: case STRICT_NE:\n" +
"        case LT: case LE: case GE: case GT:\n" +
"        case IN: case INSTANCEOF:\n" +
"        case LSH: case RSH: case URSH:\n" +
"        case PLUS: case MINUS: case MUL: case DIV: case MOD:\n" +
"        case DOT:\n" +
"            // TODO: How to deal with equal precedence?\n" +
"            if(precedence > opPrecedence[e.type])\n" +
"                write('(');\n" +
"            for(var i = 0; i < e.operands.length; ++i) {\n" +
"                if(i != 0)\n" +
"                    write(op);\n" +
"                write_expression(e.operands[i],\n" +
"                    i == 0 ? opPrecedence[e.type] : opPrecedence[e.type]+1);\n" +
"            }\n" +
"            if(precedence > opPrecedence[e.type])\n" +
"                write(')');\n" +
"            break;\n" +
"        case INCREMENT: case DECREMENT:\n" +
"            if(!e.postfix)write(op);\n" +
"            // TODO: Precedence...\n" +
"            write_expression(e.operands[0]);\n" +
"            if(e.postfix)write(op);\n" +
"            break;\n" +
"        case UNARY_PLUS:\n" +
"            write('+');\n" +
"            write_expression(e.operands[0]);\n" +
"            break;\n" +
"        case UNARY_MINUS:\n" +
"            write('-');\n" +
"            write_expression(e.operands[0]);\n" +
"            break;\n" +
"        case NEW: case DELETE: case VOID: case TYPEOF:\n" +
"        case NOT: case BITWISE_NOT:\n" +
"            write(op);\n" +
"            // TODO: Precedence...\n" +
"            write_expression(e.operands[0]);\n" +
"            break;\n" +
"        default:\n" +
"            crunchy.error(\"Unrecognized expression node type: \" + tokenstr(e.type));\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function write_var(v) {\n" +
"        write(v.type == VAR ? 'var' : 'const');\n" +
"        for(var i = 0; i < v.operands.length; ++i) {\n" +
"            if(i!=0) write(',');\n" +
"            var x = v.operands[i];\n" +
"            write_expression(x);\n" +
"            if(x.initializer) {\n" +
"                write('=');\n" +
"                write_expression(x.initializer);\n" +
"            }\n" +
"        }\n" +
"    }\n" +
"\n" +
"    function write_block(statements, curlies_required) {\n" +
"        if(statements.length == 0) {\n" +
"            if(curlies_required) {\n" +
"                write('{');\n" +
"                write('}');\n" +
"                endStatement();\n" +
"            }\n" +
"            else {\n" +
"                // The standard(7.9.1) sez:\n" +
"                //\n" +
"                // 'However, there is an additional overriding condition on the\n" +
"                // preceding rules: a semicolon is never inserted automatically if\n" +
"                // the semicolon would then be parsed as an empty statement'\n" +
"                //\n" +
"                // so a semicolon is required for empty statements.\n" +
"\n" +
"                write(';');\n" +
"                endStatement();\n" +
"            }\n" +
"        }\n" +
"        else {\n" +
"            if(curlies_required || statements.length > 1) {\n" +
"                clearInvalidOps(function() {\n" +
"                    write('{');\n" +
"                    writeStatements(statements);\n" +
"                    write('}');\n" +
"                    endStatement();\n" +
"                })\n" +
"            }\n" +
"            else {\n" +
"                writeStatements(statements);\n" +
"            }\n" +
"        }\n" +
"    }\n" +
"}\n" +
"\n" +
";(function() {\n" +
"    var escapes = { '\\\\': \"\\\\\\\\\", '\\b': \"\\\\b\", '\\t': \"\\\\t\", '\\n': \"\\\\n\",\n" +
"        '\\v': \"\\\\v\", '\\f': \"\\\\f\", '\\r': \"\\\\r\" };\n" +
"\n" +
"    var regExp = '';\n" +
"    for(var i in escapes) { regExp += escapes[i]; }\n" +
"    regExp = new RegExp('[' + regExp + ']', 'g');\n" +
"\n" +
"    crunchy.stringEscape = function(text) {\n" +
"        text = text.replace(regExp, function(x) { return escapes[x]; });\n" +
"\n" +
"        var singleQuotes = text.match(/'/g), doubleQuotes = text.match(/\"/g);\n" +
"        if(doubleQuotes && (!singleQuotes || singleQuotes.length < doubleQuotes.length)) {\n" +
"            return(\"'\" + text.replace(/'/g, \"\\\\'\") + \"'\");\n" +
"        }\n" +
"        else {\n" +
"            return('\"' + text.replace(/\"/g, '\\\\\"') + '\"');\n" +
"        }\n" +
"    }\n" +
"})();"
