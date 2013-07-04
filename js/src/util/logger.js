
/**
 ================================================================
 ================================================================
 
 logger
    
 ================================================================
 ================================================================
 */

define([], function(){
	
	"use strict";
	/*jslint browser: true, nomen: true, vars: true, plusplus: true, white: true, indent: 4  */
		
	return {
			
		_fallback: function(msg){			
			if ( console && console.log ){
				console.log(msg);
			}
		},
		
		_callLog: function(msg, type, dump){
			var errorString, logMethod;		
			// opportunity to change behavior based on type arg
			switch(type){
				case "debug":
					errorString = msg;
					logMethod = "debug";
					break;
				case "warn":
					errorString = msg;
					logMethod = "warn";
					break;
				case "error":
					errorString = msg;
					logMethod = "error";
					break;
				case "trace":
					errorString = msg;
					logMethod = "info";
					break;
				default:
					errorString = msg;
					logMethod = "log";
					break;
			}
			
			// make logging call
			if (console && console[logMethod] && console.group && console.groupEnd){

				console[logMethod](errorString);
				// dump object array if it is there
				if (dump){
					console.group("==>");
					console.log(dump);
					console.groupEnd();
				}
			
			}else{
				this._fallback(errorString);
			}
		},
		
		/* ---------------------- public api ------------------------- */
		
		log : function(msg){
			if (!__DEBUG__) {return;}
			var args;
			if (Array.prototype.slice.call(arguments, 1).length > 0){
				args = Array.prototype.slice.call(arguments, 1);
			}
			this._callLog(msg,"debug", args );
		},
		
		debug : function(msg){
			if (!__DEBUG__) {return;}
			var args;
			if (Array.prototype.slice.call(arguments, 1).length > 0){
				args = Array.prototype.slice.call(arguments, 1);
			}
			this._callLog(msg,"debug", args );
		},
		
		trace : function(msg){
			if (!__DEBUG__) {return;}
			var args;
			if (Array.prototype.slice.call(arguments, 1).length > 0){
				args = Array.prototype.slice.call(arguments, 1);
			}
			this._callLog(msg,"trace", args );
		},
		
		info : function(msg){
			if (!__DEBUG__) {return;}
			var args;
			if (Array.prototype.slice.call(arguments, 1).length > 0){
				args = Array.prototype.slice.call(arguments, 1);
			}
			this._callLog(msg,"trace", args );
		},
		
		warn : function(msg){
			var args;
			if (Array.prototype.slice.call(arguments, 1).length > 0){
				args = Array.prototype.slice.call(arguments, 1);
			}
			this._callLog(msg,"warn", args );
		},
	
		error : function(msg){
			var args;
			if (Array.prototype.slice.call(arguments, 1).length > 0){
				args = Array.prototype.slice.call(arguments, 1);
			}
			this._callLog(msg,"error", args );
		}
		
		/* ----------------------------------------------------------- */
			
	};
	
});

