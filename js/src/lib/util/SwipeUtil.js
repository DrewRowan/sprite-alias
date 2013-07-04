define([
         "jquery",
         "lib/util/classUtils"
         ],
         function($, classUtils) {
	
	"use strict";
	
	return classUtils.create({
		
		game: null,
		title: null,
		
		 triggerElementID:null, // this iable is used to identity the triggering element
		 fingerCount:0,
		 startX:0,
		 startY:0,
		 curX:0,
		 curY:0,
		 deltaX:0,
		 deltaY:0,
		 horzDiff:0,
		 vertDiff:0,
		 minLength:72, // the shortest distance the user may swipe
		 swipeLength:0,
		 swipeAngle:null,
		 swipeDirection:null,
		
		init: function()
		{	
			//
			
			//wheel_inst = _wheel;
		},
		
		caluculateAngle: function()
		{	
		/*	var X = startX-curX;
			var Y = curY-startY;
			var Z = Math.round(Math.sqrt(Math.pow(X,2)+Math.pow(Y,2))); //the distance - rounded - in pixels
			var r = Math.atan2(Y,X); //angle in radians (Cartesian system)
			swipeAngle = Math.round(r*180/Math.PI); //angle in degrees
			if ( swipeAngle < 0 ) { swipeAngle =  360 - Math.abs(swipeAngle); }
			*/
		}
		
		 
	 /*
		touchStart: function(event,passedName)
		{
			event.preventDefault();
			// get the total number of fingers touching the screen
			fingerCount = event.touches.length;
			console.log("event  " + event + "passed name is " + passedName);
			alert("Horaco swipes!");
			wheel_inst.test_func();
		}
		*/
		

		
		
 
	
	
	}); 
	

	(function($){
	    $.fn.ontouchstart = function(event,passedName) {     
	    	alert("Horacio touchstart works!");
	    	
	    	// disable the standard ability to select the touched object
			event.preventDefault();
			// get the total number of fingers touching the screen
			fingerCount = event.touches.length;
			// since we're looking for a swipe (single finger) and not a gesture (multiple fingers),
			// check that only one finger was used
			if ( fingerCount == 1 ) {
				// get the coordinates of the touch
				startX = event.touches[0].pageX;
				startY = event.touches[0].pageY;
				// store the triggering element ID
				triggerElementID = passedName;
			} else {
				// more than one finger touched so cancel
				touchCancel(event);
			}
			
			
	    };
	})(jQuery);
	
	
});