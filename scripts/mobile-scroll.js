/**
 * Provides requestAnimationFrame in a cross browser way.
 * http://paulirish.com/2011/requestanimationframe-for-smart-animating/
 */
if (!window.requestAnimationFrame) {
	window.requestAnimationFrame = (function () {
		return window.webkitRequestAnimationFrame ||
		       window.mozRequestAnimationFrame ||
		       window.oRequestAnimationFrame ||
		       window.msRequestAnimationFrame ||
		       function (callback, element) { window.setTimeout(function () { callback(new Date().getTime()); }, 1000 / 60); };
	}());
}

var mobile_scroll = (function () {
	"use strict";

	var settings, init, position, scrollPage,
	    ui_node, styling_node;

	settings = {
		"ui": '<button class="mobile-scroll" type="button">Scroll Down</button>',
		"styling": 'body > button.mobile-scroll { position: fixed; bottom: 0; right: 100; padding: 20px; }',
		"scrolling": {
			"common": null,
			"animated": true,
			"duration": 500,
			"easing": null
		}
	};

	/** POSITIONING FUNCTIONS
	 * These two functions are used to determine the scroll position of
	 * the document. Platform-independent, they're used to determine
	 * the current position and adjust the scrolling method.
	 */
	position = {
		"getX": function () {
			if (window.pageXOffset)
				return window.pageXOffset;

			// IE Crap below, just in case
			if (document.documentElement && document.documentElement.scrollLeft)
				return document.documentElement.scrollLeft;
			if (document.body.scrollLeft)
				return document.body.scrollLeft;

			return 0;
		},
		"getY": function () {
			if (window.pageYOffset)
				return window.pageYOffset;

			// IE Crap below, just in case
			if (document.documentElement && document.documentElement.scrollTop)
				return document.documentElement.scrollTop;
			if (document.body.scrollTop)
				return document.body.scrollTop;

			return 0;
		}
	};

	scrollPage = function (ev) {

		/**
		 * The event handler for the main UI interaction.
		 * This function does the actual scrolling part, as well as
		 * the overlays and animations (depending on what's needed).
		 */
		
		var starting_y, destination_y,
		    expected_y, initial_timestamp,
			animation_func, easing_func;
		
		/* Calculate the Y positioning for the act of scrolling.
		 * The starting Y is simply the current scrolling position.
		 * Destination Y position adds the height of the viewport minus
		 * the specified pixel value (the "common" space between two views
		 * that helps the user orient themselves).
		 * Any numerical value will be used as it is, whereas non-numerical
		 * values (false or null) will indicate the common value should be
		 * taken from the UI element's height.
		 */
		starting_y = position.getY();
		destination_y = starting_y +
		                window.innerHeight -
						(typeof settings.scrolling.common === "number" ?
						 settings.scrolling.common :
						 ui_node.offsetHeight);
		
		if (settings.scrolling.animated) {
		
			expected_y = null;
			initial_timestamp = new Date().getTime();
			easing_func = typeof settings.scrolling.easing === "function" ?
			              settings.scrolling.easing :
						  (function(x) { return x; });
			
			animation_func = function (timestamp) {
				var progress, current_y;
				
				/* Calculate the progress as percentage of time from the
				 * scroll initialisation and current execution. The difference,
				 * divided by total duration, will give us the percentage of
				 * elapsed time, to be used with animation.
				 */
				progress = (timestamp - initial_timestamp) / settings.scrolling.duration;
				if (progress < 1) {
				
					current_y = position.getY();
					
					/* Should the difference between expected Y value and
					 * actual Y value be too big, that might indicate the
					 * user has initiated a manual scroll mid-animation.
					 * In such case, the scrolling ceases operation immediately.
					 */
					if ((typeof expected_y === "number") &&
					    (Math.abs(expected_y - current_y) > 5)) { return; }
					
					// Calculate the next step in scrolling process taking easing into account.
					expected_y = starting_y + ((destination_y - starting_y) * easing_func(progress));
					
					window.scrollTo(position.getX(), expected_y);
					requestAnimationFrame(animation_func);
				
				}
				
			};
			requestAnimationFrame(animation_func);
		
		} else {
		
			// Static procedure (without any animations) simply
			// puts the viewport at the new position and we're done with it.
			window.scrollTo(position.getX(), destination_y);
		
		}

	};

	init = function (runtime_settings) {

		var prop;

		// Overwrite the default settings with the ones provided
		// during the initialization.
		if (typeof runtime_settings === "object" && runtime_settings) {
			for (prop in runtime_settings) {
				if (runtime_settings.hasOwnProperty(prop)) {
					settings[prop] = runtime_settings[prop];
				}
			}
		}

		// Create the main UI element and insert it into the page
		ui_node = document.createElement("div");
		ui_node.innerHTML = settings.ui;
		ui_node = ui_node.removeChild(ui_node.childNodes[0]);
		document.body.appendChild(ui_node);

		// Create the styling provided and insert it into the page
		styling_node = document.createElement("style");
		styling_node.innerHTML = settings.styling;
		document.head.appendChild(styling_node);

		// Add the event handled on the main UI element
		ui_node.addEventListener('click', scrollPage, false);

	};

	return init;

}());