if(this.window && this == this.window) {
	this.print = function(x) {
		document.write(x);
		document.write("<br>");
	}
}
else if(!this.print) this.print = function() {
	java.lang.System.out.println(arguments.join(''));
}

function resolvePath(path, currentPath) {
	path = path.split("/");
	currentPath = currentPath ? currentPath.split("/") : [];
	currentPath.pop();

	if(path[0] == "") {
		currentPath = [""];
		shift(path);
	}

	for(var i = 0; i < path.length; ++i) {
		switch(path[i]) {
			case ".":
				break;
			case "..":
				if(currentPath.length > 2 || currentPath.length == 1 && currentPath[0] != "")
					currentPath.pop();
				break;
			default:
				currentPath.push(path[i]);
				break
		}
	}

	return currentPath.join("/");
}

if(!(this.window && this.window == this)) (function() {
	var oldLoad = load;
	var currentPath = "";

	this.load = function(filePath) {
		var oldPath = currentPath;
		try {
			currentPath = resolvePath(filePath, currentPath);
			oldLoad(currentPath);
		} finally {
			currentPath = oldPath;
		}
	}
})()
else (function (){
	function createXmlHttpRequest() {
		if(window.XMLHttpRequest) {
			//try {
				return new XMLHttpRequest;
			//} catch(e) {
			//	var error = e;
			//}
		}
		if(window.ActiveXObject) {
			try {
				return new ActiveXObject("Msxml2.XMLHTTP");
			} catch(e) {
				try {
					return new ActiveXObject("Microsoft.XMLHTTP");
				}
				catch(e) {
					return new ActiveXObject("Msxml2.XMLHTTP.4.0");
				}
			}
		}
		//if(firstError) throw error;
		//else throw "No XMLHttpRequest object.";
		throw "No XMLHttpRequest object.";
	}

	var request;
	function syncLoad(path) {
		if(!request)
			request = createXmlHttpRequest();
		request.open("GET", path, false);
		request.send("");
		//if(request.status != 200)
		//	throw request.statusText;
		return request.responseText;
	}

	var currentPath = "";

	this.load = function(filePath) {
		var oldPath = currentPath;
		try {
			currentPath = resolvePath(filePath, currentPath);
			eval(syncLoad(currentPath));
		} finally {
			currentPath = oldPath;
		}
	}
})()
/**/
