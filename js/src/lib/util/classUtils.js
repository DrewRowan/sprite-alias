
/**
 ================================================================
 ================================================================

 classUtils.js

	Helper function which lets us define 'classes' in literal form
	which support a auto running init() method and
	classical inheritance
	(in es3)

	inspired by 
	https://github.com/rauschma/class-js/
	and orginally
	http://ejohn.org/blog/simple-javascript-inheritance/
	
	TODO add gotcha about object properties being class variables with this pattern

 @author geveritt
	
 ================================================================
 ================================================================
 */

var GE = GE || {};
(function () {
	"use strict";
	/*jslint browser: true, nomen: true, vars: true, plusplus: true, white: true, indent: 4, regexp: true  */

	var classUtils = {
			
			/**
			 * 
			 * @param name (:string)
			 * @param name (:boolean) OPTIONAL, default=global object
			 */
			namespace: function(name, parent){
				var o=window, j, d;
				if (typeof parent !== 'undefined' && parent !== null){o = parent;}
				d=name.split(".");
				for (j=0; j<d.length; j=j+1) {
					o[d[j]]=o[d[j]] || {};
					o=o[d[j]];
				}
				return o;
			},

			/**
			 * super simple base logging function
			 * 
			 * any number of parameters can be passd after msg and 
			 * the values will be dumped together with window.console.group
			 * (if available)
			 * 
			 * @param msg (:string)
			 */
			log: function(msg){
				
				var args = Array.prototype.slice.call(arguments, 1),
					i;

				if (!this.isString(msg)){
					args.unshift(msg);
					msg = "==>";
				}

				if ( typeof window.console !== 'undefined' && typeof window.console.log !== 'undefined' ){
					window.console.log(msg);
					if ( typeof window.console.group !== 'undefined' && typeof window.console.groupEnd !== 'undefined'){
						window.console.group("vardump");
						for (i=0;i<args.length;i++){
							window.console.log(args[i]);
						}
						window.console.groupEnd();
					}
				}

			},
			
			isString: function(arg){
				if (arg){
					return Object.prototype.toString.call(arg) === '[object String]';
				}
				return false;
			},

			isFunction: function(arg){
				if (arg){
					return Object.prototype.toString.call(arg) === '[object Function]';
				}
				return false;
			},

			isArray: function(arg) {
				if (arg){
					return Object.prototype.toString.call(arg) === '[object Array]';
				}
				return false;
			},

			isObject: function(arg){
				if (arg){
					return Object.prototype.toString.call(arg) === '[object Object]';
				}
				return false;
			},

			isBoolean: function(arg){
				if (arg){
					return Object.prototype.toString.call(arg) === '[object Boolean]';
				}
				return false;
			},

			isNumber: function(arg){
				if (arg){
					if (Object.prototype.toString.call(arg) === '[object Number]' && !isNaN(arg)){
						return true;
					}
				}
				return false;
			},

			// used internally for error reporting, of questionable value to users ...
			getType: function(arg){
				if (arg){
					return Object.prototype.toString.call(arg).match(/^\[object\s(.*)\]$/)[1];
				}
				return "undefined";
			},

			/**
			 * checks a object literal (implementor) against another literal (interfaceLiteral) treating
			 * it as an 'interface'
			 * checkImplementsInterface returns false if implementor doesn't have every property that interfaceLiteral has. 
			 * 
			 * note: This also enforces that the type is the same, for this to be useful for non-function properties
			 * interface object literals should assign dummy values to their properties so JS can determine the type.
			 * '' = string
			 * null = object
			 * 0 = number
			 * etc
			 * 
			 * @param implementor (:object)
			 * @param interfaceLiteral (:object)
			 */
			checkImplementsInterface: function(implementor, interfaceLiteral){

				var member;

				if (!this.isObject(implementor) || !this.isObject(interfaceLiteral)){
					throw new Error("arguments implementor and interfaceLiteral must both be objects");
				}

				for (member in interfaceLiteral){
					if (Object.prototype.hasOwnProperty.call(interfaceLiteral,member)){ // ignore interfaces prototype chain

						// I allow checking on the prototype chain for the property but it is not allowed to be implemented by Object 
						if (!(implementor[member]) || Object.prototype.hasOwnProperty.call( this, member )){
							return false;
						}

						if (typeof interfaceLiteral[member] !== typeof implementor[member]){
							return false;
						}

					}
				}
				return true;
			},

			/**
			 * returns a clone of source where source
			 * can be a object or array.
			 * 
			 * clone always deep copies
			 * 
			 * @param source (:object/array)
			 */
			clone: function(source){

				var newClone,
					name;

				if (!this.isObject(source) && !this.isArray(source)){ 
					throw new Error("cannot clone source, source is not an object or array. Seems to be ("+this.getType(source)+")");
				}

				// if source is a javascript core object which already supports cloning via a contructor do it
				if (source.constructor === Date || source.constructor === RegExp || source.constructor === Function ||
						source.constructor === String || source.constructor === Number || source.constructor === Boolean){
					return new source.constructor(source);
				}

				newClone = new source.constructor() || {};

				/*jslint forin:true*/
				for (name in source){
					if (this.isObject(source[name]) || this.isArray(source[name])){
						newClone[name] = this.clone(source[name]);
					}else if (!this.isFunction(source[name])){
						newClone[name] = source[name];
					}
				}
				/*jslint forin:false*/

				return newClone;

			},

			/**
			 * merge b into a but does so on a new object which it returns.
			 * 
			 * does not alter the original objects!
			 * 
			 * if force:
			 *    always override properties on b if they are on a (default false)
			 * if ignoreNew:
			 *    don't copy properties which didn't exist on b (default false)
			 * 
			 * -------------
			 * usecases:
			 * -------------
			 * 
			 * sync(a,b,false,false)
			 *     copies new properties from a to b and does not override existing properties on a.
			 *     New object has all properties of both objects but will have a's values
			 * 
			 * sync(a,b,true,false)
			 *     copies new properties from a to b and overrides existing properties on a
			 *     New object has all properties of both objects but will have b's values
			 * 
			 * sync(a,b,false,true)
			 *     does nothing
			 * 
			 * sync(a,b,true,true)
			 *     copies existing values from a to b. Ignores new properties.
			 * 
			 * @param a (:object/array)
			 * @param b (:object/array)
			 * @param force (:boolean) OPTIONAL, default=false
			 * @param ignoreNew (:boolean) OPTIONAL, default=false
			 */
			sync: function(a,b,force,ignoreNew){
				var i,
					c={};
				
				force = force || false;
				ignoreNew = ignoreNew || false;
				c = this.clone(b);

				for (i in a){
					if (Object.prototype.hasOwnProperty.call(a,i)){
						if (!(c[i])){
							// set new property on c
							if (ignoreNew===false){
								c[i] = a[i];
							}
						}else{
							// override existing property
							if (force===true){
								c[i] = a[i];
							}
						}
					}
				}

				return c;
			},

			/**
			 * baseClass which sits at the root of the prototype chain of
			 * everything created with createClass
			 */
			BaseClass: function(){},

			/**
			 * 
			 * create()
			 * 
			 * supports the following argument signatures:
			 * 
			 * 		create(properties)
			 * 		create(name, properties)
			 * 
			 * an auto constructor function and extension (classical inheritance)
			 * is supported via the following special properties in the properties argument:
			 * 
			 * 		init (function, required)
			 * 		extend (function, optional)
			 * 
			 * 		(note: as  result of this both of these are reserved for their respective purposes,
			 * 		don't use them for anything else directly within the properties argument)
			 */
			create: function(){
				
				var that = this,
					classname,
					createGlobal,
					parent = null,
					classProperties,
					args, 
					numArgs, 
					pattern='',
					i=0,
					ClassObject,
					constructorFunction,
					superPrototype,
					ParentClass,
					newPrototype,
					namespace,
					objectName,
					namespaceOjbect;

				/*
				 * digest argument pattern
				 */
				args = Array.prototype.slice.call(arguments);
				numArgs = args.length;

				// create(classProperties :object)
				if (numArgs===1 && this.isObject(args[0]) ){
					classname = null;
					createGlobal = false;
					classProperties = args[0];
				}
				
				// create(classname :string, classProperties :object)
				else if (numArgs===2 && this.isString(args[0]) && this.isObject(args[1]) ){
					classname = args[0];
					createGlobal = true;
					classProperties = args[1];
				}

				// error! invalid pattern!
				else{
					for (i=0;i<numArgs;i++){
						pattern += (this.getType(args[i]))+',';
					}
					if (pattern.substring(pattern.length-1, pattern.length)===','){
						pattern = pattern.substring(0, pattern.length-1);
					}
					this.log(args);
					throw new Error('invalid argument pattern ('+pattern+')');

				}

				// check if extend is set in classProperties and set parent
				// then delete extend from classProperties.
				if (this.isFunction(classProperties.extend)){
					parent = classProperties.extend;
					delete classProperties.extend;
				}

				// create function literal that will be returned/set as
				// our new contructor function and make it demand that 
				// the user implemented a init method
				ClassObject = function(){
					if (that.isFunction(this.init)){	
						this.init.apply(this, arguments);
					}else{
						throw new Error('user init method required.');
					}
				};
				constructorFunction = ClassObject;

				// remember the parent classes prototype, or empty if this is the first ancestor
				if (this.isFunction(parent)){
					superPrototype = parent.prototype;
				}else{
					// set baseClass as the top most prototype.
					// Because everyone gets the same prototype it allows all objects created 
					// here to pass instanceof createClass.baseClass
					superPrototype = new this.BaseClass();
				}

				//
				// create function literal that will be assigned
				// as the prototype of our new constructor function
				// 
				// the 'user class' we got passed as a literal through
				// the classProperties argument will be used to populate
				// this prototype. Additionally we set the prototypes prototype
				// to the parent (pseudo classical inheritance)
				// 
				ParentClass = function(){};
				if (superPrototype){
					ParentClass.prototype = superPrototype;
				}

				newPrototype = new ParentClass();		
				if (superPrototype){
					newPrototype._super = superPrototype;
				}

				// merge in properties from the passed in 'user class'
				for (i in classProperties){
					if (Object.prototype.hasOwnProperty.call(classProperties,i)){
						newPrototype[i] = classProperties[i];
					}
				}

				// assign the new prototype to our new blank constructor function
				constructorFunction.prototype = newPrototype;

				// create the global object (if createGlobal === true) or return a scoped object to the caller
				if (createGlobal && createGlobal === true){
					// break down the namespace and create a global object
					// from all except the last name component
					if (classname.indexOf('.', 0)===-1){
						namespaceOjbect = window;
						objectName = classname;
					}else{
						namespace = classname.substring(0,classname.lastIndexOf('.'));
						// remember the last name component
						objectName = classname.substring(classname.lastIndexOf('.')+1,classname.length);
						// create an object on Window for the namespace
						namespaceOjbect = this.namespace(namespace);
					}
					// assign child constructor to the new namespace
					namespaceOjbect[objectName] = constructorFunction;
					// we don't return anything when asked to create a global object
				}else{
					return constructorFunction;
				}
			}
			

	}; // /classUtils
	
	// expose as an AMD module if the env supports it else create an ugly global object
	if ( typeof define === "function" && define.amd) {
		define([], function () { return classUtils; } );
	}else{
		// create classUtils global object
		GE.classUtils = classUtils;
	}

}());

/*
 ================================================================
 ================================================================
 */


