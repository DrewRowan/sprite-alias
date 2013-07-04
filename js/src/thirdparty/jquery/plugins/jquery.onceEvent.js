
/**
 * small jquery plugin to add the following methods:
 * .once
 * .triggerOnce
 * which wrap around jquery's .one and .trigger methods respectively.
 * The difference is that the plugin holds state about .triggerOnce events
 * and they can caught in .once after the event has already been triggered.
 * 
 * This is useful for custom events which only happen once. (notification that
 * part of the application has finished doing something)
 * 
 * e.g.
 * 
 * the following will fail to capture anything:
 * 
 * $(document).trigger('testEvent');
 * $(document).one('testEvent',handler);
 * 
 * now use:
 * 
 * $(document).triggerOnce('testEvent');
 * $(document).once('testEvent',handler);
 * 
 * @author geveritt
 * 
 */
(function( $ ) {
	"use strict";
	/*jslint browser: true, nomen: true, vars: true, plusplus: true, white: true, indent: 4  */
	
	/**
	 * TODO signature is identical to jQuery's .one EXCEPT
	 * the first formal paramater can only be a single event
	 */
	$.fn.once = function(event, data, handler) {
		var onceEvents = this.data('onceEvents') || {},
			triggerImmediately = false;
		
		// as per spec for jquery.one, data is optional,
		// if it's missing the handler is in the second param
		handler = handler || data;
		
		// check if the event has already been triggered with triggerOnce
		if (typeof onceEvents[event] !== 'undefined'){
			delete onceEvents[event];
			triggerImmediately = true;
		}
		
		// listen for event  ... 
		this.one(event, data, function(){
			if ($.isFunction(handler)){
				handler.apply(this, Array.prototype.slice.call(arguments));
			}
		});
		
		// trigger event immediately if it was found in onceEvents
		// the reason we don't just call the handler is so the handler 
		// can still recieve the normal event object
		if (triggerImmediately){
			this.trigger(event);
		}

	};
	
	/**
	 * signature is identical to jQuery's .trigger
	 */
	$.fn.triggerOnce = function(eventType) {
		var onceEvents = this.data('onceEvents') || {};
		
		// add this event to the onceEvents object and save
		onceEvents[eventType] = true;
		this.data('onceEvents', onceEvents);
		
		// call jQuery.trigger on the event.
		this.trigger.apply(this, Array.prototype.slice.call(arguments));
	};
	
})( jQuery );
