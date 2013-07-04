
/**
 * Sprite.js
 * 
 * spritesheet based animation.
 * 
 * TODO's
 * - handle variable frame size: What happens? align left? align center?
 * 
 * @author geveritt
 */
define(["jquery", "lib/util/classUtils", "thirdparty/jquery/plugins/jquery.imagesloaded"], function($, classUtils) {
	
	"use strict";

	return classUtils.create({
		
		_internalsReady: null,
		_fps: 30,
		_currentFrame: 0,
		_fixedFrame: false,
		_manualFrame: false,
		_width: null,
		_height: null,
		_useFallbackRenderer: false,
		_underlyingElement: null,
		_parent: null,
		_replaceParent: false,
		_lastSkipFrameDelta: 0,
		_jugglerLastTimestamp: 0,
		_jugglerRAF: null,
		
		_ready: function(){
			return !(this.promise().state() !== "resolved");
		},
		
		init: function(config, parent, replaceParent){
			
			var that = this;
			
			// 0) validate params
			if (!config){
				throw Error("invalid Sprite signature. Sprite(parent, config) required. ");
			}
			// parent can be a selector string
			if (parent){
				if (classUtils.isString(parent)){
					parent = $(""+parent);
				}
				// wrap with $(), this allows parent to be a jQuery object or a native object
				if ($(parent).length !== 1){
					throw Error("invalid parent passed into Sprite, couldn't find parent.");
				}
			}
			
			that._parent = $(parent);
			that._replaceParent = replaceParent || false;
			
		    // setup _underlyingElement immediately so .get() works, width/height will be set when we can 
		    
		    // CANVAS rendering
		    if (!that._useFallbackRenderer){
		    	that._underlyingElement = document.createElement('canvas');
		    }
		    
		    // DOM rendering
		    else{
		    	that._underlyingElement = $("<div></div>").css("overflow","hidden");
				that._underlyingElement.append($("<div></div>").width("100%").height("100%"));
		    }
			
			// all class methods which depend on init having been completed will wait on this guy
			that._internalsReady = $.Deferred();
			
			// 1) load config if it's a path to a JSON file
			var configReady = $.Deferred();
			if (classUtils.isString(config)){
				// try to load JSON from file with an XHR
				$.getJSON(config, function(data, textStatus, jqXHR){
					config = data;
					configReady.resolve();
				}).error(function(jqXHR, textStatus, errorThrown) {
					throw Error("invalid config path passed to Sprite, failure requesting/parsing json: ("+errorThrown+")");
				});
			}else if(classUtils.isObject(config)){
				// resolve immediately
				configReady.resolve();
			}else{
				throw Error("Sprite must be passed config object or path. Passed arg of "+classUtils.getType(config));
			}
			
			// 2) digest config, load sprite frames/atlases
			var configLoaded = $.Deferred();
			$.when(configReady).then(function(){
					
				// MUST have fixed or manual config
				if (config.fixedFrame && classUtils.isObject(config.fixedFrame)){
					that._fixedFrame = config.fixedFrame;
				}else if (config.manualFrame && classUtils.isObject(config.manualFrame) && config.manualFrame.frames && classUtils.isArray(config.manualFrame.frames)){
					that._manualFrame = config.manualFrame;
				}else{
					throw Error("invalid config passed to Sprite. Must have fixedFrame OR manualFrame");
				}
				
				that._fps = config.fps;
				
				// if not manual frame, construct the manual frame config from whatever we do that,
				// that way all further code can treat everything the same.
				
				if (!that._manualFrame){
					
					that._manualFrame = {};
					that._manualFrame.frames = [];
					
					if (that._fixedFrame.atlasSequence){
						
						for (var i=0; i<that._fixedFrame.atlasSequence.length; i++){
							
							var atlas = that._fixedFrame.atlasSequence[i],
								currentX = atlas.startX + atlas.paddingX,
								currentY = atlas.startY + atlas.paddingY,
								// X wrap threshold, how many frames fit on each row of the sheet in X
								wrapThreshold = (Math.floor( atlas.atlasWidth / that._fixedFrame.frameWidth ) - 1) * that._fixedFrame.frameWidth;
							
							for (var j=0; j<atlas.numFrames; j++){
								
								var frame = {};
								frame.filename = atlas.atlasPath;
								frame.sourceSize = {
										"w": atlas.atlasWidth,
										"h": atlas.atlasHeight
								};
								
								frame.frame = {
										"x": currentX,
										"y": currentY,
										"w": that._fixedFrame.frameWidth,
										"h": that._fixedFrame.frameHeight
								};
								
								that._manualFrame.frames.push(frame);
								
								// advance currentX, currentY
								currentX += (that._fixedFrame.frameWidth + atlas.paddingX);
								
								// wrap Y down the sheet if needed ... 
								if (currentX > wrapThreshold){
									currentX = atlas.startX + atlas.paddingX;
									currentY += (that._fixedFrame.frameHeight + atlas.paddingY);
								}
								
							}
							
						}
						
					}else if (that._fixedFrame.frameSequence){
						
						var index = that._fixedFrame.frameSequence.imageStartIndex;
						for (var i=0; i<that._fixedFrame.frameSequence.numFrames; i++){
							
							var frame = {};
							frame.filename = that._fixedFrame.frameSequence.imageRoot + that._fixedFrame.frameSequence.imagePrefix + index + that._fixedFrame.frameSequence.imageSuffix;
							frame.sourceSize = {
									"w": that._fixedFrame.frameWidth,
									"h": that._fixedFrame.frameHeight
							};
							frame.frame = {
									"x": 0,
									"y": 0,
									"w": that._fixedFrame.frameWidth,
									"h": that._fixedFrame.frameHeight
							};
							
							that._manualFrame.frames.push(frame);
							
							index++;
							
						}
					
					}
					
					// in either path above, frame size must be fixed and is given in the config
					
					that._width = that._fixedFrame.frameWidth;
					that._height = that._fixedFrame.frameHeight;
					
				}else{
					
					// calculate _width/_height for manualFrame
					
					var winningW = 0, winningH = 0;
					
					for (var i=0; i<that._manualFrame.frames.length; i++){
						
						var frame = that._manualFrame.frames[i].frame;
						
						if (frame.w > winningW ){
							winningW = frame.w;
						}
						
						if (frame.h > winningH){
							winningH = frame.h;
						}
						
					}
					
					that._width = winningW;
					that._height = winningH;
					
				}
				
				// preload atlases / frames
				var imagesLoading = [], imagePaths = {};
				
				for(var i=0; i<that._manualFrame.frames.length; i++){
					var frame = that._manualFrame.frames[i];
					// load this, store image in the atlas object
					// note: do duplicates matter here for any browser?
					if (!imagePaths[frame.filename]){
						frame.image = new Image();
						frame.image.src = frame.filename;
						imagePaths[frame.filename] = frame.image;
						imagesLoading.push(frame.image);
					}else{
						frame.image = imagePaths[frame.filename];
					}
				}
				
				// wait for all the images we loaded to be finished, then resolve configLoaded so we can proceed to 3)
				$(imagesLoading).imagesLoaded(function(images, proper, broken){
					
					imagesLoading = null;
					imagePaths = null;
					
					if (broken.length !== 0){
						// note: reason this isn't a hard error is because imagesLoaded reports there are some known
						// bugs on some versions of opera where we will get the callback but images/proper/broken lists might be wrong
						console.warn('probably failed to preload Sprite resource(s) check net panel.');
					}
					
					// pre-render frames to detached canvas elements outside the render loop
					if (!that._useFallbackRenderer){
						for(var i=0; i<that._manualFrame.frames.length; i++){
							var frame = that._manualFrame.frames[i],
								ctx;
							frame.preRendered = document.createElement('canvas');
							frame.preRendered.width = frame.frame.w;
							frame.preRendered.height = frame.frame.h;
							ctx = frame.preRendered.getContext('2d');
							ctx.drawImage(frame.image, frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h, 0, 0, frame.frame.w, frame.frame.h);
							frame.image = null;
						}
					}
					
					configLoaded.resolve();
				});
				
			});
			
			// 3) setup renderer / create underlying DOM elements
			$.when(configLoaded).then(function(){
				
				// pick render method:
				var testCanvas = document.createElement('canvas');
			    if (!testCanvas.getContext) {
			    	that._useFallbackRenderer = true;
			    }
			    
			    // set width/height for _underlyingElement now that we have the config
			    
			    // CANVAS rendering
			    if (!that._useFallbackRenderer){
			    	
			    	that._underlyingElement.width = that._width;
			    	that._underlyingElement.height = that._height;
					
			    }
			    
			    // DOM rendering
			    else{
			    	
					that._underlyingElement.width(that._width);
					that._underlyingElement.height(that._height);
			    	
			    }
			    
			    // embed underlying elements into parent passed in to init
			    if (that._parent){
				    if (that._replaceParent){
				    	that._parent.html(that._underlyingElement);
				    }else{
				    	that._parent.append(that._underlyingElement);
				    }
			    }
			    
			    //console.log("frames: ",that._manualFrame.frames);
			    
			    that._internalsReady.resolve();
			    
			    // show the first frame of the animation
			    that.showFrame(0);
				
			});
			
		},
		
		promise: function(){
			return this._internalsReady.promise();
		},
		
		// this._underlyingElement is created immediately so this is always safe to call,
		// however Sprite might not be rendering to it yet
		get: function(){
			return $(this._underlyingElement);
		},

		/**
		 * called internally, additionally intended for callers who won't use the juggler functions
		 * and instead will control the sprite in their own rendering loop
		 * 
		 * note: callers should wait until the sprite is ready before calling advanceTime (with .promise())
		 * 
		 */
		advanceTime: function(delta, loop){
			
			var that = this;
					
			if (!that._ready()){
/* 				console.warn("Sprite.advanceTime called before Sprite ready."); */
				return false;
			}
			
			if (!loop && loop !== false){
				loop = true;
			}
			
			// loop can also be the frame to stop advancing
			if (loop === that._currentFrame){
				return false;
			}
			
			delta = delta + that._lastSkipFrameDelta;
			
			var interval = 1000 / that._fps;
			var threshold = 1.0;
			// I've made this a bit fuzzy. even requestAnimationFrame is not going to give perfect 60hz results, 
			// so experimenting with allowing a thresold of -n ms around the delta
			if (delta < interval && (delta+threshold) < interval){
				//console.warn("skipping frame. delta = ", delta);
				that._lastSkipFrameDelta = delta;
				return true;
			}
			
			that._lastSkipFrameDelta = 0;
			
	    	// get frame
	    	var frame;
	    	if (that._manualFrame.frames[that._currentFrame]){
	    		frame = that._manualFrame.frames[that._currentFrame];
	    	}else{
	    		if (!loop){
	    			return false;
	    		}
	    		frame = that._manualFrame.frames[0];
	    		that._currentFrame = 0;
	    	}
	    	if (!frame){
	    		throw new Error("couldn't get frame for index: "+that._currentFrame);
	    	}
	    	
	    	that._currentFrame++;
			
	    	that._renderFrame(frame);
			
		    return true;
		    
		},
		
		_renderFrame: function(frame){
			
			var that = this;
			
			// CANVAS rendering
		    if (!that._useFallbackRenderer){
		    	
		    	// draw frame to the canvas
				var ctx = that._underlyingElement.getContext('2d');
				
				// clear canvas
				ctx.clearRect(0, 0, that._width, that._height);
				
				// draw frame to underlying canvas:
				ctx.drawImage(frame.preRendered, 0, 0, frame.frame.w, frame.frame.h);
				
		    }
		    
		    // DOM rendering (fallback, only really for old ie but beware performance is going to be far worse then modern browsers that support canvas)
		    else{
		    	
		    	var frameDiv = that._underlyingElement.children(":first").get(0);
		    	frameDiv.style.backgroundImage = "url('"+frame.image.src+"')";
		    	frameDiv.style.backgroundPosition = (-frame.frame.x) +"px "+ (-frame.frame.y) +"px";
		    	
		    }
	    	
		},
		
		showFrame: function(index){
			
			var that = this;
			
			if (!that._ready()){
/* 				console.warn("Sprite.showFrame called before Sprite ready."); */
				return;
			}
			
			var frame;
	    	if (!that._manualFrame.frames[index]){
	    		throw new Error("couldn't get frame for index: "+index);
	    	}
	    	frame = that._manualFrame.frames[index];
	    	
	    	that._currentFrame = index;
	    	
	    	that._renderFrame(frame);
			
		},
		
		reset: function(){
			if (!this._ready()){
/* 				console.warn("Sprite.reset called before Sprite ready."); */
				return;
			}
			this._currentFrame = 0;
		},
		
		destroy: function(){
			this.jugglerStop();
			$(this._underlyingElement).remove();
		},
		
		jugglerPlay: function(loop){
			
			var that = this,
				ticking = false;
			
			loop = loop || false;
			
			$.when(this.promise()).then(function(){
				
				function juggle(timestamp){
					if (that._manualFrame.frames[that._currentFrame] || loop){
						
						var delta = timestamp - that._jugglerLastTimestamp;
						that._jugglerLastTimestamp = timestamp;
						
						that._jugglerRAF = requestAnimationFrame(juggle);
						
						if (!ticking){
							ticking = true;
							that.advanceTime(delta, true); // always pass true for loop param. jugglerPlay manages this here
							ticking = false;
						}
						
					}
				};
				that._jugglerRAF = requestAnimationFrame(juggle);
			
			});
			
		},
		
		jugglerPlayFrom: function(){
			// TODO impl
		},
		
		jugglerPause: function(){
			if (!this._ready()){
/* 				console.warn("Sprite.jugglerPause called before Sprite ready."); */
				return;
			}
			cancelAnimationFrame(this._jugglerRAF);
		},
		
		jugglerStop: function(){
			if (!this._ready()){
/* 				console.warn("Sprite.jugglerStop called before Sprite ready."); */
				return;
			}
			this.reset();
			cancelAnimationFrame(this._jugglerRAF);
		}
		
	});
	
});