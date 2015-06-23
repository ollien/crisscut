var url = require("url")

var routeTree = {
	path:"/",
	type:"explicit",
	children:[],
	callback:undefined
}

module.exports = Crisscut

function Crisscut(routes){
	if (routes!==undefined){
		routes = correctRoutes(routes)
		console.log(routes);
		addRoutesToRouteTree(routes)	
	}
}
Crisscut.prototype.route = function(req,res,errCallback){
	var parsedUrl = url.parse(req.url)
	var rawUrl = parsedUrl.pathname
	var rawArguments = parsedUrl.query
	var routeResult = findRouteFromUrl(rawUrl);
	if (routeResult!=null){
		var methods = routeResult.methods;
		var args = routeResult.args;
		var method = req.method.toLowerCase();
		var parsedUrlArgs = parseArguments(rawArguments);
		console.log(rawArguments);
		console.log(parsedUrlArgs);
		if (methods.hasOwnProperty(method)){
			methods[method].apply({},[req,res].concat(args,parsedUrlArgs))
		}
		else if (methods.hasOwnProperty("on")){
			methods.on.apply({},[req,res].concat(args,parsedUrlArgs))
		}
		else{
			errCallback(methodNotAllowed(rawUrl,method));
		}
	}
	else{
		errCallback(pathNotFound(rawUrl))
	}
}

function correctRoutes(routes){
	Object.keys(routes).forEach(function(route){
		var original = route
		var value = routes[route]
		if (route[0]==="/" && route.length>1){ //Routes must not begin with a /, unless they are /
			route = route.substring(1)
		}
		if (route[route.length-1]==="/" && route.length>1){ //Routes must not end with a /, unless of course, they are to the homepage.
			route = route.substring(0,route.length-1)
		}
		if (route!=original){
			delete routes[original]
			routes[route] = value
		}
		if (typeof routes[route] === "object"){
			Object.keys(routes[route]).forEach(function(item){
				if (item!=item.toLowerCase()){
					var value = routes[route][item]
					delete routes[route][item]
					routes[route][item.toLowerCase()] = value
				}
			})
		}
	})
	return routes
}


function addRouteToRouteTree(route,functions,parentNode){
	if (route.length===0){
		return; //No point in adding a route that literally is nothing.
	}
	if (route==="/"){ // We already have a root element pre-made, we can just add a function in
		routeTree.functions = functions
		return; 
	}
	var routeSplit = route.split("/")
	if (parentNode===undefined || parentNode===null){
		parentNode = routeTree
	}
	var index = findObjectWithPropertyValueInArray(parentNode.children, "path",routeSplit[0])
	if (index>-1){
		routeSplit.shift()
		addRouteToRouteTree(routeSplit.join("/"), functions, parentNode.children[index])
	}
	else{
		var type = routeSplit[0][0]===":" ? "variable":"explicit"
		if (type==="variable"){
			type = routeSplit[0][1]==="(" && routeSplit[0][routeSplit[0].length-1]===")" ? "regex":"variable"
		}
		if (type==="variable"){
			index = findObjectWithPropertyValueInArray(parentNode.children, "type", "variable")
			if (index>-1){
				routeSplit.shift()
				addRouteToRouteTree(routeSplit.join("/"), functions, routeSplit.children[index])
			}
			else{
				var leaf = createLeaf(routeSplit[0], type)
				parentNode.children.push(leaf)
				routeSplit.shift()
				if (routeSplit.length>0){
					addRouteToRouteTree(routeSplit.join("/"), functions, leaf)
				}
				else{
					leaf.functions = functions
				}
			}
		}
		else{
			var leaf = createLeaf(routeSplit[0], type)
			parentNode.children.push(leaf)
			routeSplit.shift()
			if (routeSplit.length>0){
				addRouteToRouteTree(routeSplit.join("/"), functions, leaf)
			}
			else{
				leaf.functions = functions
			}
		}
	}
}

function addRoutesToRouteTree(routes){
	Object.keys(routes).forEach(function(route){
		addRouteToRouteTree(route,routes[route])
	})
}

function findRouteFromUrl(url,parentNode,args){
	if (parentNode===null || parentNode===undefined){
		parentNode = routeTree
	}
	if (args===null || args===undefined){
		args = []
	}
	if (url==="/"){
		if (parentNode.functions==null){
			return null;
		}
		else{
			return {
				methods:parentNode.functions,
				args:args
			}
		}
	}
	else{
		if (url[0]==="/"){
			url = url.substring(1);	
		} 
		if (url[url.length-1]==="/"){
			url = url.substring(0,url.length-1)
		}
		
	}
	var urlSplit = url.split("/")
	var index = findObjectWithPropertyValueInArray(parentNode.children, "path", urlSplit[0])
	//If we have an explicit route, use it, otherwise, we need to do some searching.
	if (index>-1){
		urlSplit.shift()
		if (urlSplit.length>0){
			return findRouteFromUrl(urlSplit.join("/"), parentNode.children[index],args)
		}
		else{
			var methods = parentNode.children[index].functions
			if (methods===null || methods===undefined){
				return null
			}

			return {
				methods:methods,
				args:args
			}
		}
	}
	else{
		var regexIndexes = findObjectsWithPropertyValueInArray(parentNode.children, "type", "regex")
		var variableIndex = findObjectWithPropertyValueInArray(parentNode.children, "type", "variable") //There should only ever be one variable in the tree.
		for (var i=0; i<regexIndexes.length; i++){
			var index = regexIndexes[i];
			var match = urlSplit[0].match(parentNode.children[index].path.substring(1)); 
			if (match && match[0]===urlSplit[0]){
				args.push(urlSplit[0])
				urlSplit.shift()
				if (urlSplit.length>0){
					return findRouteFromUrl(urlSplit.join("/"), parentNode.children[index],args)
				}
				else{
					var methods = parentNode.children[index].functions
					if (methods===null || methods===undefined){
						return null
					}

					return {
						methods:methods,
						args:args
					}
				}
			}
		}
		//If we haven't matched regex, we can see if we have a variable. otherwise, we return null.
		if (variableIndex>-1){
			args.push(urlSplit[0])
			urlSplit.shift()
			if (urlSplit.length>0){
				return findRouteFromUrl(urlSplit.join("/"),parentNode.chldren[variableIndex],args)
			}
			else{
				var methods = parentNode.children[index].functions
				if (methods===null || methods===undefined){
					return null
				}

				return {
					methods:methods,
					args:args
				}
			}
		}	
	}
}

function createLeaf(name,type,func){
	return {
		path:name,
		type:type,
		children:[],
		func:func,
	}
}

function parseArguments(queryString){
	if (queryString[0]==="?"){
		queryString = queryString.substring(1)
	}
	var andSplit = queryString.split("&")
	var parsedArgs = {}
	andSplit.forEach(function(item){
		var split = item.split("=")
		parsedArgs[split[0]]=split[1]
	});
	return parsedArgs
}

function pathNotFound(path){
	return {
		errorCode:404,
		error:path+" is not a known route."
	}
}
function methodNotAllowed(path,method){
	return {
		errorCode:405,
		error: method+" is not allowed on "+path
	}

}
function arrayHasObjectWithProperty(array,property){
	for (var i = 0; i<array.length; i++){
		if (array[i].hasOwnProperty(property)){
			return true
		}
	}
	return false
}

function arrayHasObjectWithPropertyValue(array,property,value){
	for (var i = 0; i<array.length; i++){
		if (array[i].hasOwnProperty(property) && array[i][property]===value){
			return false
		}
	}
	return true
}

function findObjectWithPropertyValueInArray(array,property,value){
	for (var i = 0; i<array.length; i++){
		if (array[i].hasOwnProperty(property) && array[i][property]===value){
			return i
		}
	}
	return -1
}

function findObjectsWithPropertyValueInArray(array,property,value){
	var results = []
	for (var i = 0; i<array.length; i++){
		if (array[i].hasOwnProperty(property) && array[i][property]===value){
			results.push(i)
		}
	}
	return results
}

function clone(object){
	return JSON.parse(JSON.stringify(object))
}
