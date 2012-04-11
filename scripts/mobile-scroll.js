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
		       function (callback) { window.setTimeout(function () { callback(new Date().getTime()); }, 1000 / 60); };
	}());
}

/**
 * A small fix for iOS-based devices (these lack the
 * appropriate .bind() method).
 */
if (!Function.prototype.bind) {
	Function.prototype.bind = function (context) {
		var original_function = this,
		    curry_arguments = Array.prototype.slice.call(arguments, 1);
		return function () {
			var total_arguments = curry_arguments.concat(Array.prototype.slice.call(arguments, 0));
			return original_function.apply(context, total_arguments);
		};
	};
}

var mobile_scroll = (function () {
	"use strict";

	var settings, init, position, scrollPage,
	    ui_node, styling_node, overlay_node,
		adjustOverlay, in_scroll;

	settings = {
		"ui": '<button class="mobile-scroll ui-node" type="button">Scroll Down</button>',
		"overlay": '<div class="mobile-scroll overlay-node"></div>',
		"styling": ['body > button.mobile-scroll.ui-node {',
						'position: fixed;',
						'bottom: 0;',
						'right: 0',
						'padding: 20px;',
					'}',
					'body > .mobile-scroll.overlay-node {',
						'position: absolute;',
						'top: 0;',
						'left: 0;',
						'width: 100%;',
						'height: 0;',
						'background-color: rgba(0, 0, 0, 0.5);',
						'transition: height 500ms ease-in 0;',
						'-webkit-transition: height 500ms ease-in 0;',
						'-moz-transition: height 500ms ease-in 0;',
						'-ms-transition: height 500ms ease-in 0;',
						'-o-transition: height 500ms ease-in 0;',
					'}'].join(' '),
		"scrolling": {
			"common": 100,
			"animated": true,
			"duration": 500,
			"easing": null
		}
	};

	// This boolean variable is used to determine whether
	// the automatic scrolling is currently being carried out;
	// This is to prevent the overlay from being hidden on animations,
	// as calls to scrollTo() also trigger the 'scroll' event.
	in_scroll = false;

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

	scrollPage = function () {

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

			/* Initialize the neccessary variables here.
			 * expected_y is used to hold the shift value over
			 * multiple execution of the frame, so that actual positioning
			 * can then be compared (to detect whether the user decided to
			 * scroll on his own).
			 * Easing function takes one argument (percentage of animation
			 * elapsed, from 0 to 1) and outputs actual value to use in scrolling
			 * calculation.
			 * Additionally, automatic scroll is set as happening via in_scroll
			 * variable and the overlay is adjusted via adjustOverlay function
			 * (assuming it's transitioned, so it will take some time to reach
			 * the destination height).
			 */
			expected_y = null;
			initial_timestamp = new Date().getTime();
			easing_func = typeof settings.scrolling.easing === "function" ?
			              settings.scrolling.easing :
						  function (x) { return x; };

			//
			in_scroll = true;
			adjustOverlay(false, destination_y);

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
					if ((typeof expected_y === "number") && (Math.abs(expected_y - current_y) > 5)) {

						in_scroll = false;
						adjustOverlay(true);

					} else {

						// Calculate the next step in scrolling process taking easing into account.
						expected_y = starting_y + ((destination_y - starting_y) * easing_func(progress));

						window.scroll(position.getX(), expected_y);
						window.requestAnimationFrame(animation_func);

					}

				// Once the entire scroll animation has been done, make
				// sure to set the flag for automatic scrolling back to false
				// (so that removal of overlay on manual scrolling works correctly).
				} else { in_scroll = false; }

			};
			window.requestAnimationFrame(animation_func);

		} else {

			// Static procedure (without any animations) simply
			// puts the viewport at the new position and we're done with it.
			window.scroll(position.getX(), destination_y);
			adjustOverlay(false, destination_y);

		}

	};

	adjustOverlay = function (hide, y_position) {

		/**
		 * The adjustment function sets the height CSS property
		 * on the overlay node either to 0 pixels (hiding it) or to
		 * specified value (automatically extended for the common area).
		 */

		var adjustment;
		hide = (typeof hide !== "undefined" ? !!hide : true);

		if (!hide) {
			adjustment = (y_position +
			              (typeof settings.scrolling.common === "number" ?
						   settings.scrolling.common :
						   ui_node.offsetHeight)) + "px";
		} else {
			adjustment = "0px";
		}

		overlay_node.style.height = adjustment;

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

		// Create the overlay element and insert it into the page
		overlay_node = document.createElement("div");
		overlay_node.innerHTML = settings.overlay;
		overlay_node = overlay_node.removeChild(overlay_node.childNodes[0]);
		document.body.appendChild(overlay_node);

		// Create the main UI element and insert it into the page
		ui_node = document.createElement("div");
		ui_node.innerHTML = settings.ui;
		ui_node = ui_node.removeChild(ui_node.childNodes[0]);
		document.body.appendChild(ui_node);

		// Create the styling provided and insert it into the page
		styling_node = document.createElement("style");
		styling_node.innerHTML = settings.styling;
		document.head.appendChild(styling_node);

		// Add the event handler on the main UI element
		ui_node.addEventListener('click', scrollPage, false);

		// Add the event handler on window scrolling;
		// Any manual scrolling should immediately disable
		// the overlay (case for automatic scrolling, which
		// also throws this event, should be included
		window.addEventListener('scroll', function () { if (!in_scroll) { adjustOverlay(true); } }, false);

	};

	return init;

}());