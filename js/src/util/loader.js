
/**
 ================================================================
 ================================================================

 loader.js

 documentation:
 ________________________________________________________________

loader can load 
 
 	- scripts with the include method
 	- image/text resources with the get and bulk methods
 
 Script requests starting with . or / or ending in .js will use default path rules
 (the same as if you had created a script tag yourself with the path as passed)
 and will always load the file (cannot check if its already loaded)
 
 Additionally scripts can be requested without those markers where Loader
 will try to resolve the path against the configured packages root path.
 
	 e.g.
	 
	 for a request for 'GE/util/Map'
	 Loader will check:
	 (packages_root)/GE/util/Map.js

 @author geveritt
 
 @dependency jQuery 1.7+
 @dependency jQuery.imagesLoaded

 ================================================================
 ================================================================
 */

/*
 * loader
 */
(function (document, window, $) {
	"use strict";
	/*jslint browser: true, nomen: true, vars: true, plusplus: true, white: true, indent: 4, regexp: true  */
	
	// _packagesRoot trys to default to the parent directory of the directory where loader is
	var defaultPackagesRoot = null,
		scripts = document.getElementsByTagName("script");
		
	if (scripts.length>0){
		var thisScript = scripts[scripts.length-1],  // pull the last script (should be this one?)
			thisScriptSrc = thisScript.src || '';
		// set defaultPackagesRoot
		if (thisScriptSrc.split("/").length - 1 >= 2){
			defaultPackagesRoot = thisScriptSrc.substring(0,thisScriptSrc.lastIndexOf('/'));
			defaultPackagesRoot = defaultPackagesRoot.substring(0,defaultPackagesRoot.lastIndexOf('/'));
			if (defaultPackagesRoot.substring(defaultPackagesRoot.length-1,defaultPackagesRoot.length) !== '/'){
				defaultPackagesRoot += '/';
			}
		}
	}

	var loader = {
			
			_ajaxTimeout: null,
			_packagesRoot: defaultPackagesRoot || '',
			_scriptCache: true,
			_getReadyEventName: 'getFinished',
			_scriptReadyEventName: 'includeFinished',
			_lastUID: 0,
			
			// --------------------------------- public API ---------------------------------

			/**
			 * 
			 */
			configure: function(settings){
				// _packagesRoot
				if (this._isString(settings.root)){
					if (settings.root.substring(settings.root.length-1,settings.root.length) !== '/'){
						settings.root += '/';
					}
					this._packagesRoot = settings.root;
				}
				// _scriptCache
				this._scriptCache = settings.scriptCache || this._scriptCache;
			},

			/**
			 * Loader.get( resources [, options] [, forceRefresh] )
			 * 
			 * loads image or text resources immediately (takes array or string)
			 * 
			 * executes the options.each callback FOR EACH resource when it's loaded passing the resource window.Object.
			 * executes the options.complete callback FOR EACH resource when the load is complete passing
			 * 		the amount of time taken to load in ms.
			 * 
			 * if options argument is a function then its treated as a single options.all callback
			 * 
			 * Caches by default. (unless forceRefresh is true)
			 * 
			 * Returns a jQuery deferred object.
			 * 
			 * - consider refactoring the argument pattern to be inline with include()
			 * 
			 */
			get: function(resources, options, forceRefresh){

				if (typeof resources === 'undefined'){
					throw new Error('loader::get() invalid argument pattern');
				}
				
				var that = this,
					i = 0,
					cache = true,
					numResources = 0,
					numLoaded = 0,
					loadFinished = false,
					loadStart = 0,
					timeToLoad = 0,
					allCallback,
					ulid = (this._generateUID()),
					deferred = $.Deferred(),
					loadedResources = [];
				
				if (forceRefresh){
					cache = false;
				}
					
				// setup defaults if options is left out
				if (typeof options === 'undefined'){
					options = {};
					options.each = null;
					options.all = null;
				}else if ($.isFunction(options)){
					allCallback = options;
					options = {};
					options.all = allCallback;
					options.each = null;
				}
				
				if (!that._isArray(resources)){
					var passedResource = resources;
					resources = [];
					resources.push(passedResource);
				}

				numResources = resources.length;

				loadStart = new Date().getTime();
				
				// load all resources:
				for (i=0;i<numResources;i++){
					that._getResource(resources[i], cache, function(path, data){
						numLoaded +=1;
						
						loadedResources.push({"path":path,"data":data});
						that._executeCallback(options.each, path, data);
						
						// finished?
						if (numLoaded >= numResources){
							loadFinished = true;
							$(that).trigger(that._getReadyEventName+"."+ulid);
						}
					});
				}
				
				// this call to get sends a unique event so options.complete
				// can be dispatched. Wait for it here...
				$(that).one(that._getReadyEventName+"."+ulid, function(){
					loadFinished = false; // switch this off so we know the event was captured
					timeToLoad = new Date().getTime() - loadStart;
					deferred.resolve(loadedResources);
					this._executeCallback(options.all, timeToLoad);
					return;
				});
				// if load finished before we bound the bound the event...
				if (loadFinished===true){$(that).trigger(that._getReadyEventName+"."+ulid);}
				
				return deferred;
			},

			/**
			 * 
			 * Loader.include( includes [, callback] )
			 * 
			 * loads a script resource 
			 * if the callback parm is given it loads immediately and executes the
			 * callback function when it's finished loading
			 * 
			 * caches depending on the value of Loader._scriptCache
			 * 
			 * when an array of scripts is passed as includes the following
			 * heppend to try to achieve the best performance:
			 * - load all scripts in parallel with ajax as dataType=text (cache)
			 * - (once complete) load scripts again with dataType=script, crossDomain=true
			 * 	which does script tag injection preserving order
			 * 
			 * Returns a jQuery deferred object.
			 * 
			 */
			include: function(includes, rootNamespace, callback){
				
				// validate arguments
				if (!includes){
					throw new Error('loader::include() invalid argument pattern. Must include includes');
				}
				if (!this._isString(includes) && !this._isArray(includes)){
					throw new Error('loader::include() invalid argument pattern. includes must be a string or an array');
				}
				if (callback && !$.isFunction(callback)){
					throw new Error('loader::include() invalid argument pattern. callback must be a function');
				}
				
				rootNamespace = rootNamespace || window;
				
				var i=0,
					that = this,
					noCacheId = null,
					numLoaded = 0,
					numIncludes = 0,
					waitingPreCache = 0,
					thisScript = null,
					loadFinished = false,
					loading = false,
					ulid = (this._generateUID()),
					deferred = $.Deferred();
				
				// includes is allowed to be passed in as a
				// string but will be treated as an array hence forth...
				if (includes && !that._isArray(includes)){
					includes = includes.split();
				}
				
				if (!that._scriptCache){
					noCacheId = "?noCache="+new Date().getTime();
				}
				
				numIncludes = includes.length;
				waitingPreCache = includes.length;
				
				// recursive function
				function loadInOrder(includes){
					var nextInclude = includes.shift();
					
					that._injectScript(nextInclude, function(){
						numLoaded +=1;
						
						// finished?
						if (numLoaded >= numIncludes){
							loadFinished = true;
							$(that).trigger(that._scriptReadyEventName+"."+ulid);
							return;
						}else{
							// resurively call loadInOrder again
							loadInOrder(includes);
						}
					});
				
				};
				
				// resolve script names and add nocache param (if needed)
				for (i=0; i<numIncludes; i++){
					
					// resolve name
					if (this._isResolvable(includes[i])){
						includes[i] = this._packagesRoot + includes[i] + '.js';
					}
					
					if (noCacheId){
						includes[i] = includes[i] + noCacheId;
					}
					
				}
				
				// pre-cache all scripts in parallel
				for (i=0; i<numIncludes; i++){
					thisScript = includes[i];
					
					if (that._isCrossDomain(thisScript)){
						
						if (window.console && window.console.warn){
							window.console.warn("not pre-caching cross domain script: "+thisScript);
						}
						
						waitingPreCache-=1;
						
						// once all scripts are cached or skipped, proceed to inject the real script tags in sequence
						if (waitingPreCache <=0 && !loading){
							loading = true;
							loadInOrder(includes);
						}
						
					}else{
						
						// same-domain scripts are always pre-cached.
						// this is technically wasteful if that._scriptCache = true
						// but if the script is cached by the browser this precache should finish immediately
						
						this._precacheScript(thisScript, function(){
							waitingPreCache-=1;
							// once all scripts are cached or skipped, proceed to inject the real script tags in sequence
							if (waitingPreCache <=0 && !loading){
								loading = true;
								loadInOrder(includes);
							}
						});
						
					}

				}
				
				// this call to get sends a unique event so callback
				// can be dispatched. Wait for it here...
				$(that).one(that._scriptReadyEventName+"."+ulid, function(){
					loadFinished = false; // switch this off so we know the event was captured
					deferred.resolve();
					this._executeCallback(callback);
					return;
				});
				// if load finished before we bound the bound the event...
				if (loadFinished===true){$(that).trigger(that._scriptReadyEventName+"."+ulid);}

				return deferred;
			},

			// ------------------------------------------------------------------------------

			/**
			 * 
			 */
			_generateUID: function(){
				this._lastUID += 1;
				return this._lastUID;
			},
			
			/**
			 * 
			 */
			_getResource: function(resource, cache, callback){
				var that = this,
					image = null;
				
				if (that._isImage(resource)){
					image = new Image();
					if (!cache){
						image.src = resource+"?noCache="+new Date().getTime();
					}else{
						image.src = resource;
					}
					$(image).imagesLoaded(function(images, proper, broken){
						/* if (broken.length===0){ */
							that._executeCallback(callback, resource, image);
						/*
}else{
							throw new Error('loader::_getResource() failure. ('+resource+')');
						}
*/
					});
				}else{
					$.ajax({
						url: resource,
						dataType: 'text',
						timeout: this._ajaxTimeout,
						async: true,
						cache: cache,
						error: function(jqXHR, textStatus, errorThrown){
							switch(textStatus){
								case "timeout":
									throw new Error('loader::_getResource() timeout. ('+resource+')');
								default:
									throw new Error('loader::_getResource() error = "'+errorThrown+'" ('+resource+')');
							}
							
						},
						success: function(data, textStatus, jqXHR){
							that._executeCallback(callback, resource, data);
						}
					});	
				}
			},
			
			
			/*
			 */
			_precacheScript: function(script, callback){
				var that = this;
				
				$.ajax({
					url: script,
					dataType: "text",
					timeout: that._ajaxTimeout,
					async: true,
					cache: true, // always turn ajax cache on, the caller manually controls caching by appending a timestamp if required
					error: function(jqXHR, textStatus, errorThrown){
						switch(textStatus){
							case "timeout":
								throw new Error('loader::_precacheScript() timeout. ('+script+')');
							default:
								throw new Error('loader::_precacheScript() error = "'+errorThrown+'" ('+script+')');
						}
					},
					success: function(data, textStatus, jqXHR){
						that._executeCallback(callback, script);
						return;
					}
				});
				
			},
			
			
			/**
			 * EXPERIMENT
			 * where I can use eval to load the script inside a function
			 * and/or pass some variables... ummm
			 */
			_loadScript: function(script, rootNamespace, callback){
				var that = this;
				rootNamespace = rootNamespace || "window";
				$.ajax({
					url: script,
					dataType: "text",
					timeout: that._ajaxTimeout,
					async: true,
					cache: true, // always turn ajax cache on, the caller manually controls caching by appending a timestamp if required
					error: function(jqXHR, textStatus, errorThrown){
						switch(textStatus){
							case "timeout":
								throw new Error('loader::_loadScript() timeout. ('+script+')');
							default:
								throw new Error('loader::_loadScript() error = "'+errorThrown+'" ('+script+')');
						}
					},
					success: function(data, textStatus, jqXHR){
						
						// TODO could this be made any safer?
						
						eval("(function(){var rootNamespace = '"+rootNamespace+"'; "+data+"}());");
						
						that._executeCallback(callback, script);
						return;
					}
				});
				
				
			},
			
			/**
			 * 
			 */
			_injectScript: function(script, callback){
				var that = this;
				
				$.ajax({
					url: script,
					dataType: "script",
					timeout: that._ajaxTimeout,
					crossDomain: true, // tells jQuery to do script tag injection
					async: true,
					cache: true, // always turn ajax cache on, the caller manually controls caching by appending a timestamp if required
					error: function(jqXHR, textStatus, errorThrown){
						switch(textStatus){
							case "timeout":
								throw new Error('loader::_loadScript() timeout. ('+script+')');
							default:
								throw new Error('loader::_loadScript() error = "'+errorThrown+'" ('+script+')');
						}
					},
					success: function(data, textStatus, jqXHR){
						that._executeCallback(callback, script);
					}
				});
				
				
			},
			
			/**
			 * experimental custom implementation of script tag injection.
			 * A custom implementation would let me play with 
			 * 	- caching scripts using a unknown type and 
			 *  - not deleting the injected tags (what jquery does) 
			 *  so I could guard against double includes
			 *  
			 * However it's a bit scary because of all the browser hacks needed,
			 * things Id much prefer to leave in the hands of a 
			 * library to maintain
			 * 
			 * -----------------------------------------------------------------
			 * 
			 * learned weird browser bahavior from
			 * http://requirejs.org/docs/release/1.0.8/comments/require.js
			 * (req.attach method)
			 * 
			 * TODO:
			 * - is this working in all browsers I care about?
			 * - are my events getting cleaned up properly? (especially in old ie?)
			 * 
			 */
			/*
			_injectScriptTag: function(script, type, callback){
				var that = this,
					isOpera = typeof opera !== "undefined" && opera.toString() === "[object Opera]",
					newScriptTag = document.createElement("script"),
					scriptLoadCallback,
					head = document.getElementsByTagName("head")[0],
					baseElement = document.getElementsByTagName("base")[0];
				
				// setup script tag and attach event handler
				newScriptTag.type = type;				
				newScriptTag.charset = "utf-8";
				newScriptTag.async = false;
				
				scriptLoadCallback = function(e){
					var script = e.currentTarget || e.srcElement;
		            if (script.detachEvent && !isOpera) {
		            	script.detachEvent("onreadystatechange", scriptLoadCallback);
		            } else {
		            	script.removeEventListener("load", scriptLoadCallback, false);
		            }
		            // run user callback passed into _injectScriptTag
		            that._executeCallback(callback, script.src);
				};
				
				// Opera supports both but we want it to use addEventListener
				if (newScriptTag.attachEvent && !(newScriptTag.attachEvent.toString && newScriptTag.attachEvent.toString().indexOf('[native code]') < 0) && !isOpera) {
					newScriptTag.attachEvent("onreadystatechange", scriptLoadCallback);
				}else{
					newScriptTag.addEventListener("load", scriptLoadCallback, false);
				}
				newScriptTag.src = script;
				
				// add script tag to dom
								
				// use insertBefore instead of appendChild if base is in the document 
				// (IE6 bug)
				// http://dev.jquery.com/ticket/2709
		        if (baseElement) {
		        	head = baseElement.parentNode;
		            head.insertBefore(newScriptTag, baseElement);
		        } else {
		        	head.appendChild(newScriptTag);
		        }
			},
			*/

			/*
			 * takes a script include path and resolves the global namespace name
			 */
			_resolve: function(include){
				var globalName = null, nameParts=null, globalObject = window, i=0;
				if (!this._isString(include)){
					throw new Error('loader::resolve() invalid argument passed. ('+include+')');
				}
				nameParts = include.split("/");
				globalName = nameParts.join(".");
				for (i=0; i<nameParts.length; i++){
					if (typeof globalObject[nameParts[i]] !== 'undefined'){
						globalObject = globalObject[nameParts[i]];
					}else{
						return {globalName:globalName, globalObject:false};
					}
				}
				return {globalName:globalName, globalObject:globalObject};
			},

			/*
			 * if an include matches any of the following patterns we decide we can't
			 * resolve its namespace from the packages root and try to avoid loading something
			 * which is already present
			 * 
			 * - begins with / or .
			 * - ends with .js
			 * 
			 */
			_isResolvable: function(include){
				if (/^[\.|\/](?:[\s\S])*/i.test(include) || 
						/^(?:[\s\S])*(\.js)$/i.test(include)){
					return false;
				}
				return true;
			},
			
			_executeCallback: function(callback){
				var callbackArgs = Array.prototype.slice.call(arguments,1);
				if (window.Object.prototype.toString.call(callback) === '[object Function]'){
					callback.apply(this, callbackArgs);
				}
			},

			_isImage: function(path){
				if (typeof path !== 'undefined' && window.Object.prototype.toString.call(path) === '[object String]'){
					return (/[\s\S]+(\.(jpg|jpeg|png|gif|bmp))$/i).test(path);
				}
				return false;
			},

			_isString: function(string){
				if (typeof string !== 'undefined' && window.Object.prototype.toString.call(string) === '[object String]'){
					return true;
				}
				return false;
			},
			
			_isArray: function(array){
				if (typeof array !== 'undefined' && window.Object.prototype.toString.call(array) === '[object Array]'){
					return true;
				}
				return false;
			},
			
			_isCrossDomain: function(script){
				if (script.indexOf('http') === 0){
					if ( script.indexOf('http://'+document.domain) !== 0 &&
						 script.indexOf('http://www'+document.domain) !== 0 &&
						 script.indexOf('https://'+document.domain) !== 0 &&
						 script.indexOf('https://www'+document.domain) !== 0){						
						return true;
					}
				}
				return false;
			}

	};
	
	// expose as an AMD module if the env supports it else create an ugly global object
	// note: if envs want to use the AMD module then they must provide named modules for our deps
	// http://jquery.com/
	// http://github.com/desandro/imagesloaded
	if ( typeof define === "function" && define.amd) {
		define(["jquery", "thirdparty/jquery/plugins/jquery.imagesloaded"], function () { return loader; } );
	}else{
		// create classUtils global object
		window.GE = window.GE || {};
		window.GE.loader = loader;
	}
	
	
}(document, window, window.jQuery));
