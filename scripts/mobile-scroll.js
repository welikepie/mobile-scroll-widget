(function () {
    "use strict";
    
    /**
     * Provides requestAnimationFrame in a cross browser way.
     * http://paulirish.com/2011/requestanimationframe-for-smart-animating/
     */
    if ((typeof window !== 'undefined') && (!window.requestAnimationFrame)) {
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
    
    /* AMD Module Definition
     * The script is defined as easily reusable module.
     */
    (function (define) {
        define('mobileScroll', ['hammer'], function () {
        
            var settings,
                in_scroll,
                ui_button,
                ui_overlay,
                ui_menu,
                ui_drag,
            
                mobileScroll,
                scrollPage,
                adjustOverlay,
                
                element,
                position;
            
            settings = {
                'ui': '<button type="button" class="mobile-scroll button">Scroll Down</button>',
                'overlay': '<div class="mobile-scroll overlay"></div>',
                'menu': null,
                'shortcuts': null,
                
                'duration': 500,
                'easing': null,
                'common': 100,
                'side': 'left'
            };
            
            scrollPage = function (ev) {
            
                /**
                 * The event handler for the main UI interaction.
                 * This function does the actual scrolling part, as well as
                 * the overlays and animations (depending on what's needed).
                 */
                
                var starting_y, destination_y, expected_y,
                    start_timestamp, anim_func, ease_func;
                
                ev.preventDefault();
                
                // IMPORTANT! We don't want the button to activate while it's being dragged.
                if (ui_drag.drag_state !== 0) { return; }
                
                starting_y = position.getY();
                destination_y = starting_y +
                                window.innerHeight -
                                (typeof settings.common === 'number' ?
                                 settings.common :
                                 ui_node.offsetHeight);
                
                if (settings.duration > 0) {
                
                    expected_y = null;
                    start_timestamp = new Date().getTime();
                    ease_func = typeof settings.easing === 'function'
                                  ? settings.easing
                                  : function (x) { return x; };
                    
                    in_scroll = true;
                    adjustOverlay(destination_y);
                    
                    anim_func = function (timestamp) {
                        var progress, current_y;

                        /* Calculate the progress as percentage of time from the
                         * scroll initialisation and current execution. The difference,
                         * divided by total duration, will give us the percentage of
                         * elapsed time, to be used with animation.
                         */
                        progress = (timestamp - start_timestamp) / settings.duration;
                        if (progress < 1) {

                            current_y = position.getY();

                            /* Should the difference between expected Y value and
                             * actual Y value be too big, that might indicate the
                             * user has initiated a manual scroll mid-animation.
                             * In such case, the scrolling ceases operation immediately.
                             */
                            if ((typeof expected_y === 'number') && (Math.abs(expected_y - current_y) > 5)) {

                                in_scroll = false;
                                adjustOverlay(-1);

                            } else {

                                // Calculate the next step in scrolling process taking easing into account.
                                expected_y = starting_y + ((destination_y - starting_y) * ease_func(progress));

                                window.scroll(position.getX(), expected_y);
                                window.requestAnimationFrame(anim_func);

                            }

                        // Once the entire scroll animation has been done, make
                        // sure to set the flag for automatic scrolling back to false
                        // (so that removal of overlay on manual scrolling works correctly).
                        } else { in_scroll = false; }

                    };
                    window.requestAnimationFrame(anim_func);
                
                } else {
                
                    // Static procedure (without any animations) simply
                    // puts the viewport at the new position and we're done with it.
                    window.scroll(position.getX(), destination_y);
                    adjustOverlay(destination_y);
                
                }
            
            };
            
            adjustOverlay = function (y_position) {

                /**
                 * The adjustment function sets the height CSS property
                 * on the overlay node either to 0 pixels (hiding it) or to
                 * specified value (automatically extended for the common area).
                 */

                var adjustment;

                if (y_position !== -1) {
                    adjustment = (y_position +
                                  (typeof settings.common === 'number' ?
                                   settings.common :
                                   ui_button.offsetHeight)) + "px";
                } else {
                    adjustment = "0px";
                }

                ui_overlay.style.height = adjustment;

            };
            
            mobileScroll = function (args) {
            
                // Merge settings
                for (x in args)
                    if (args.hasOwnProperty(x))
                        settings[x] = args[x];
                
                // Create elements
                ui_overlay = element(settings.overlay);
                window.document.body.appendChild(ui_overlay);
                ui_button = element(settings.ui);
                ui_button.className += ' ' + (settings.initial || 'left');
                window.document.body.appendChild(ui_button);
                
                // Add the event handler on the main UI element
                ui_button.addEventListener('click', scrollPage, false);
                
                // Add the event handler on window scrolling;
                // Any manual scrolling should immediately disable
                // the overlay (case for automatic scrolling, which
                // also throws this event, should be included)
                window.addEventListener('scroll', function () { if (!in_scroll) { adjustOverlay(-1); } }, false);
                
                /* Set up the touch event handler (from Hammer.js) to handle
                 * dragging of the main UI element. Due to how touch events are processed,
                 * the dragging requires the set-up on the container, not the dragged element.
                 * In this case, the entire body of a document in question.
                 * Should the initial target of the touch event be the UI element, its position
                 * will be adjusted based on the X position of the touch point relative to viewport.
                 */
                ui_drag = new Hammer(document.body, {
                    drag: true,
                    drag_horizontal: true,
                    drag_vertical: true,
                    transform: false
                });
                
                // The dragging of a button has three states:
                // 0 :: the UI element is not dragged around
                // 1 :: the UI element IS dragged around
                // 2 :: the UI element is currently heading for its final location
                //      (snapping to one of the corners, essentially)
                ui_drag.drag_state = 0;
                ui_drag.last_position = null;
                
                ui_drag.ondragstart = function (ev) {
                
                    // Fix for IE browsers
                    var target = ev.originalEvent.target || ev.originalEvent.srcElement;
                
                    // Initiate the drag process only if the initial target
                    // is the UI element AND the element is free to be dragged
                    if ((this.drag_state === 0) && (target === ui_button)) {
                    
                        // Set the state and remove any positioning classes
                        this.drag_state = 1;
                        ui_button.className = ui_button.className
                            .replace(/(?:^|\s)left(?:$|\s)/, ' ')
                            .replace(/(?:^|\s)right(?:$|\s)/, ' ');
                    
                    }
                
                };
                
                ui_drag.ondrag = function (ev) {
                
                    // If currently doing the drag on the button,
                    // it's position should be adjusted to match the X coord
                    // of the touch point (and saved for usage with ondragend,
                    // as that event does not provide the last read position).
                    if (this.drag_state === 1) {
                    
                        this.last_position = ev.position.x;
                        ui_button.style.left = (ev.position.x - (ui_button.offsetWidth / 2)) + "px";
                    
                    }
                
                };
                
                ui_drag.ondragend = function (ev) {
                
                    /* Once the drag of the button is completed, it should
                     * neatly snap into one of the bottom corners. The selection
                     * of the corner is done simply by comparing last X position
                     * with the width of the viewport. If it's on the left side of
                     * the viewport, the button will snap to the left. If it's on
                     * the right side, it will snap to the right.
                     * 
                     * The snapping is done as follows:
                     * First, the class is added to the UI element with transition
                     * setup on "left" CSS property - that is to make sure the snapping
                     * is done with nice visuals.
                     * Second, the callback function is created and bound to "transitionend"
                     * event (to be executed once the snapping bit is completed). This function
                     * will remove pixel-based positioning, replacing it with either "left: 0;"
                     * or "right: 0;", as well as remove the transition class (and immediately
                     * unbind itself, as not to interfere with any other possible events).
                     * Finally, depending on the last position of the button, the snap point
                     * is selected and the positioning property changed, initiating the transition.
                     */
                    
                    if (this.drag_state === 1) {
                    
                        var snap_position, transition_func, fallback;
                    
                        // Change the drag state to 2 (so that no drag events can interfere)
                        this.drag_state = 2;
                        ui_button.className += ' animated';
                        
                        transition_func = function (ev) {
                        
                            ui_button.style.left = null;
                            ui_button.className = ui_button.className
                                .replace(/(?:^|\s)animated(?:$|\s)/, ' ');
                            ui_button.className += ' ' + snap_position;
                            
                            ui_button.removeEventListener("transitionend", transition_func, false);
                            ui_button.removeEventListener("webkitTransitionEnd", transition_func, false);
                            ui_button.removeEventListener("MSTransitionEnd", transition_func, false);
                            ui_button.removeEventListener("oTransitionEnd", transition_func, false);
                            
                            if (typeof fallback !== 'undefined') { window.clearTimeout(fallback); fallback = null; }
                            
                            this.drag_state = 0;
                            this.last_position = null;
                        
                        }; transition_func = transition_func.bind(this);
                        
                        ui_button.addEventListener("transitionend", transition_func, false);
                        ui_button.addEventListener("webkitTransitionEnd", transition_func, false);
                        ui_button.addEventListener("MSTransitionEnd", transition_func, false);
                        ui_button.addEventListener("oTransitionEnd", transition_func, false);
                        
                        fallback = window.setTimeout(transition_func, 1000);
                        
                        if (this.last_position <= (window.innerWidth / 2)) {
                            snap_position = "left";
                            ui_button.style.left = "0px";
                        } else {
                            snap_position = "right";
                            ui_button.style.left = (window.innerWidth - ui_button.offsetWidth) + "px";
                        }
                    
                    }
                
                };
            
            };
            
            element = function (html) {
                var el = document.createElement('div');
                el.innerHTML = html;
                return el.removeChild(el.childNodes[0]);
            };
            
            position = {
                'getX': function () {
                    if (window.pageXOffset)
                        return window.pageXOffset;

                    // IE Crap below, just in case
                    if (document.documentElement && document.documentElement.scrollLeft)
                        return document.documentElement.scrollLeft;
                    if (document.body.scrollLeft)
                        return document.body.scrollLeft;

                    return 0;
                },
                'getY': function () {
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
            
            return mobileScroll;
        
        });
    }(typeof define === 'function' ? define : function (a, b, factory) {
        if (typeof module !== 'undefined') { module.exports = factory(); }
        else { window.mobileScroll = factory(); }
    }));

}());