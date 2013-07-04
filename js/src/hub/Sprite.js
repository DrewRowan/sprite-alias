/* 
	Author: Drew Rowan;
	Version: 0.1;

*/

define([
         "jquery",
         "lib/util/classUtils",
         
         ],
         function($, classUtils) {
	
	"use strict";

	return classUtils.create({
		
		debug: true,

		el: null, //this is going to be the element we want to animate
		path: null, //this is the path to the json file
		jsonContents: null, //parsed json

		animateTimeout: null,
		currentFrame: 1,
		
		init:function(_el, _path, _options){
		
			//default options
		
			var options = {
				fps: 12,
				playing: true,
				playOnce: false,
				playFrames: 1,
				startFrame: 1,
				stopAfter: 1,
				reverse: false,
				alternateDirection: false,
				listenForFrame: new Array(), //the thinking behind this is that it will listen out for any frame you want and will fire an event (multiple frames)
			};
			
			var _self = this;
			
			_self.el = _el;
			_self.path = _path;
			
			_self.el.options = options;
			
			var keys = new Array();
			for(var key in _options)
			{
			   keys[keys.length] = key;
			   _self.el.options[key] = _options[key];
			}
			
			var jqxhr = $.getJSON( _path, function(data) {
				_self.jsonContents =  data;
				if(_self.el.options.reverse === true){
					_self.currentFrame = _self.jsonContents.frames.length;
				}				
				if(_self.el.options.playing === true){
					_self.spPlay();
				}
			})
			.fail(function() { console.error('Json path incorrect or incorrectly formatted') });
			
		},
		
		spPlay: function(){
						
			var _self = this;
			
			_self.el.css('background-position-x', '-'+_self.jsonContents.frames[_self.currentFrame-1].frame.x + 'px ');
			_self.el.css('background-position-y', '-'+_self.jsonContents.frames[_self.currentFrame-1].frame.y + 'px ');
			
			if(_self.el.options.reverse === true){
				
				if(_self.currentFrame > 1){
					_self.currentFrame--;
				}else{
					_self.currentFrame = _self.jsonContents.frames.length;
					if(_self.el.options.alternateDirection === true){
						_self.el.options.reverse = false;
						_self.currentFrame = 1;
						
					}
				}
				
			}else{
			
				if(_self.currentFrame < _self.jsonContents.frames.length){
					_self.currentFrame++;
				}else{
					_self.currentFrame=1;
					if(_self.el.options.alternateDirection === true){
						_self.el.options.reverse = true;
						_self.currentFrame = _self.jsonContents.frames.length;
					}
				}
			}	
			/* if($.inArray(listenForFrame, _self.currentFrame)){} */

			if(_self.el.options.playOnce === false || _self.currentFrame < _self.jsonContents.frames.length){		
				_self.animateTimeout = setTimeout(function() {
					_self.spPlay(_self.el.options);
				}, parseInt(1000 / _self.el.options.fps));
			}
		},
		
		spStop: function(destroy, backToFirst){
		
			var _self = this;
			
			window.clearTimeout(_self.animateTimeout);			
			
			if(backToFirst === true){
				
				_self.el.css('background-position-x', '-'+_self.jsonContents.frames[0].frame.x + 'px ');
				_self.el.css('background-position-y', '-'+_self.jsonContents.frames[0].frame.y + 'px ');
				
			}
			
			if(destroy === true){
				
				_self.spDestroy(true);
				
			}	
			
		},
		
		spDestroy: function(spStopFirst){

			var _self = this;
			//this is going to have some very important tasks to do later
			if(spStopFirst === false){
				window.clearTimeout(_self.animateTimeout);
			}
			
		}
		
	});

});