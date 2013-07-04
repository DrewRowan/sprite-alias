
/**
 * where it begins ...  
 */
require([
         "jquery",
         "config",
         "hub/Hub"
         ],
         function($, config, Hub) {
	
	"use strict";
	/*jslint browser: true, nomen: true, vars: true, plusplus: true, white: true, indent: 4  */
	
	window.muteall = 1;
	
	new Hub();
	
});