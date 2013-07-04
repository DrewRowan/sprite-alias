define([
         "jquery",
         "lib/util/classUtils",
         "hub/Sprite"
         
         ],
         function($, classUtils, Sprite) {
	
	"use strict";

	return classUtils.create({
		
		debug: true,
		sprite: null,
		newsprite: null,
		
		init:function(){
			
			var _self = this;
			_self.sprite = new Sprite(
				$('#left'), 
				"assets/sprites/left.json",
				{
					"fps": 24,
					"reverse" : true,
					"alternateDirection" : true
				}
			);
			
			/*
setTimeout(function(){
				_self.newsprite = new Sprite(
					$('#secondleft'), 
					"assets/sprites/left.json",
					{
						"fps": 24,
						"playOnce": true
					}
				);
			}, 500);
*/
    	
		}
		
	});

});