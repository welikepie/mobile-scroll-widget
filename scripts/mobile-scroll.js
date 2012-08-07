/**
 * MOBILE SCROLL WIDGET
 * ********************
 * Useful bit of JavaScript code, ready to be dropped into any document to provide the visitors
 * with one-click button for scrolling the documents, as well as an optional list of shortcuts.
 * Functionality includes following:
 * - scrolls the page by screen height with every click
 * - optionally leaves some common space between scrolls to help the users find themselves within the page
 * - can be dragged from one corner of screen to another (if current placement obscures view)
 * - placement persists between loads
 * - can be hidden completely
 * - can be held to access list of site shortcuts
 *
 * The script has the dependency on Hammer.js (for dragging the button from one corner to another).
 */

/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, browser:true, maxerr:50 */
/*global ActiveXObject: true, Hammer: true, define: true, module: true */

(function () {
    "use strict";

    // Provides requestAnimationFrame in a cross browser way.
    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    if ((typeof window !== 'undefined') && (!window.requestAnimationFrame)) {
        window.requestAnimationFrame = (function () {
            return window.webkitRequestAnimationFrame ||
                   window.mozRequestAnimationFrame ||
                   window.oRequestAnimationFrame ||
                   window.msRequestAnimationFrame ||
                   function (callback) { window.setTimeout(function () { callback(new Date().getTime()); }, 1000 / 60); };
        }());
    }

    // A small fix for iOS-based devices (these lack the appropriate .bind() method).
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

    /* The script attempt to follow the AMD module definitions for
     * problem-free inclusion in pages, regardless of what method has been
     * used to load the script in the first place.
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

                preferences,
                util;

            /* Following settings can be provided when initialising the widget:
             *
             * - ui        - The element that will act as a button triggering the scroll.
             *               Can be either a DOM element or HTML string.
             * - overlay   - The overlay element used to mark the parts of the page already seen.
             *               Extends over the page starting from the top every time a button is pressed. 
             *               Can be either a DOM element or HTML string.
             * - menu      - Boolean. If true, holding the button instead of tapping/clicking it will
             *               bring up the menu and (if set) list of shortcuts.
             * - shortcuts - If the menu is enabled, it can also sport a structured list of links.
             *               Should the property be set, it should be a path to local JSON file containing
             *               the links - they will be loaded asynchronously into the menu.
             *
             * - duration  - Duration of a single scroll in miliseconds.
             * - easing    - Easing used for the scroll. Should be either NULL (defaults to linear scrolling)
             *               or a function that takes one number between 0 and 1 and outputs another number
             *               between 0 and 1 (converts time progression into animation progression).
             * - common    - Height in pixels of an area of a screen that is visible before and after a
             *               scroll, used as a "mark" to help users figure out where they are on the page
             *               (set to NULL to have the common area match the height of a button).
             * - side      - Default position of a button, "left" or "right".
             */
            settings = {
                'ui': '<button type="button">Scroll Down</button>',
                'overlay': '<div></div>',
                'menu': false,
                'shortcuts': null,

                'duration': 500,
                'easing': null,
                'common': 100,
                'side': 'left'
            };

            scrollPage = function () {

                /**
                 * The event handler for the main UI interaction.
                 * This function does the actual scrolling part, as well as
                 * the overlays and animations (depending on what's needed).
                 */

                var starting_y, destination_y, expected_y,
                    start_timestamp, anim_func, ease_func;

                // IMPORTANT! We don't want the button to activate while it's being dragged.
                if (ui_drag.drag_state !== 0) { return; }

                // Calculate where we are in the page and where we want to be
                // (height of the screen minus the common area).
                starting_y = util.position.getY();
                destination_y = starting_y +
                                window.innerHeight -
                                (typeof settings.common === 'number' ?
                                 settings.common :
                                 ui_button.offsetHeight);

                if (settings.duration > 0) {

                    expected_y = null;
                    start_timestamp = new Date().getTime();
                    ease_func = (typeof settings.easing === 'function') ? settings.easing : function (x) { return x; };

                    // Adjust the overlay first (this way, if it's using
                    // transitions, it'll animate alongside the scrolling).
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

                            current_y = util.position.getY();

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

                                window.scroll(util.position.getX(), expected_y);
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
                    window.scroll(util.position.getX(), destination_y);
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
            
                /**
                 * Initialisation function sets up the DOM elements and event handlers
                 * required for the scrolling widget to work.
                 */

                var x, xhr;

                // Merge default settings with custom
                // options set during initialisation.
                for (x in args) {
                    if (args.hasOwnProperty(x)) {
                        settings[x] = args[x];
                    }
                }
                
                // Load any user-set preferences from the cookies.
                // Currently, only the position is persistent.
                settings.side = (preferences.get('position') || settings.side);

                // Initialise required DOM elements
                if (typeof settings.ui === 'string') {
                    ui_overlay = util.element(settings.overlay);
                } else if (!!settings.ui.parentNode) {
                    ui_overlay = settings.ui.parentNode.removeChild(settings.ui);
                } else {
                    ui_overlay = settings.ui;
                }
                util.addClass(ui_overlay, 'mobile-scroll');
                util.addClass(ui_overlay, 'overlay');
                document.body.appendChild(ui_overlay);
                
                if (typeof settings.ui === 'string') {
                    ui_button = util.element(settings.ui);
                } else if (!!settings.ui.parentNode) {
                    ui_button = settings.ui.parentNode.removeChild(settings.ui);
                } else {
                    ui_button = settings.ui;
                }
                util.addClass(ui_button, 'mobile-scroll');
                util.addClass(ui_button, 'button');
                util.addClass(ui_button, settings.side);
                document.body.appendChild(ui_button);

                /* If the menu setting has been set to true, generate the DOM elements
                 * required and, optionally, initialise the XHR request to obtain the shortcuts
                 * from the shortcuts file and insert them as well.
                 */
                if (settings.menu) {

                    ui_menu = util.element('<div class="mobile-scroll menu ' + settings.side + '"></div>');
                    document.body.appendChild(ui_menu);

                    ui_menu.displayPrefs = function () {
                    
                        /**
                         * This function generates the preferences display and inserts
                         * it into the menu while removing any possible old preference displays.
                         * It can be used after the initialisation to "refresh" settings in case
                         * they are modified (like the position of a button can be modified by
                         * dragging it).
                         */

                        var i, el = this.getElementsByClassName('settings');
                        for (i = el.length - 1; i >= 0; i -= 1) {
                            el[i].parentNode.removeChild(el[i]);
                        }

                        el = util.element([
                            '<div class="settings">',
                                '<label>Position: ',
                                    '<select size="1" class="position">',
                                        '<option value="left" ' + (settings.side === 'left' ? 'selected' : '') + '>Left</option>',
                                        '<option value="right" ' + (settings.side === 'right' ? 'selected' : '') + '>Right</option>',
                                        '<option value="hidden">Hidden</option>',
                                    '</select>',
                                '</label>',
                            '</div>'
                        ].join(''));

                        if (this.childNodes.length) { this.insertBefore(el, this.childNodes[0]); }
                        else { this.appendChild(el); }

                    };
                    // Use displayPrefs() immediately to create the initial pref screen
                    ui_menu.displayPrefs();

                    ui_menu.applyPrefs = function () {
                    
                        /**
                         * Application of preferences ensures the the current settings
                         * affect the interface as required - for example, the button should
                         * change its position to value specified it settings. It is being
                         * used after changing some of the settings and closing the menu
                         * to ensure the prefs and interface are in sync.
                         */

                        var settings, position;

                        try {

                            settings = this.getElementsByClassName('settings')[0];
                            position = settings.getElementsByClassName('position')[0];

                            // Hide the button if option to hide it has been selected
                            // (not persistent, since it also hides the means to access the menu)
                            if (position.value === 'hidden') {
                                util.addClass(ui_button, 'hidden');
                            // Ensure both the button and the menu sticking to whichever side
                            // of the screen has been selected in the preferences.
                            } else {
                                settings.side = position.value;
                                preferences.set('position', position.value);
                                util.removeClass(ui_button, 'left');
                                util.removeClass(ui_button, 'right');
                                util.addClass(ui_button, position.value);
                                util.removeClass(ui_menu, 'left');
                                util.removeClass(ui_menu, 'right');
                                util.addClass(ui_menu, position.value);
                            }

                        } catch (e) {}

                    };

                    if (typeof settings.shortcuts === 'string') {

                        xhr = (window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP'));
                        xhr.onreadystatechange = function () {
                        
                            /* Populate the shortcut list with a recursive function that creates
                             * list elements for URLs and sub-lists for inner collections.
                             */

                            var shortcuts, link_func = function (item) {
                                var key, el, temp;

                                el = util.element('<ul></ul>');
                                for (key in item) {
                                    if (item.hasOwnProperty(key)) {

                                        if (typeof item[key] === 'string') {
                                            temp = util.element('<li><a href="' + item[key] + '">' + key + '</a></li>');
                                        } else {
                                            temp = util.element('<li></li>');
                                            temp.appendChild(link_func(item[key]));
                                        }
                                        el.appendChild(temp);

                                    }
                                }
                                return el;
                            };

                            if (this.readyState === 4) {
                                if (this.status === 200) {

                                    shortcuts = JSON.parse(this.responseText);
                                    shortcuts = link_func(shortcuts);
                                    shortcuts.className = 'shortcuts';
                                    ui_menu.appendChild(shortcuts);

                                }
                            }

                        };
                        xhr.open('GET', settings.shortcuts, true);
                        xhr.send();

                    }

                }

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
                        util.removeClass(ui_button, 'left');
                        util.removeClass(ui_button, 'right');

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

                ui_drag.ondragend = function () {

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
                        util.addClass(ui_button, 'animated');

                        transition_func = function () {

                            ui_button.style.left = null;
                            util.removeClass(ui_button, 'animated');
                            util.addClass(ui_button, snap_position);

                            util.unhandle(ui_button, "transitionend", transition_func, false);
                            util.unhandle(ui_button, "oTransitionEnd", transition_func, false);
                            util.unhandle(ui_button, "MSTransitionEnd", transition_func, false);
                            util.unhandle(ui_button, "transitionend", transition_func, false);

                            if (typeof fallback !== 'undefined') { window.clearTimeout(fallback); fallback = null; }

                            this.drag_state = 0;
                            this.last_position = null;

                        }; transition_func = transition_func.bind(this);

                        util.handle(ui_button, "transitionend", transition_func, false);
                        util.handle(ui_button, "oTransitionEnd", transition_func, false);
                        util.handle(ui_button, "MSTransitionEnd", transition_func, false);
                        util.handle(ui_button, "transitionend", transition_func, false);

                        fallback = window.setTimeout(transition_func, 1000);

                        if (this.last_position <= (window.innerWidth / 2)) {
                            snap_position = "left";
                            ui_button.style.left = "0px";
                        } else {
                            snap_position = "right";
                            ui_button.style.left = (window.innerWidth - ui_button.offsetWidth) + "px";
                        }

                        settings.side = snap_position;
                        preferences.set('position', snap_position);
                        if (settings.menu) {
                            ui_menu.displayPrefs();
                            util.removeClass(ui_menu, 'left');
                            util.removeClass(ui_menu, 'right');
                            util.addClass(ui_menu, snap_position);
                        }

                    }

                };

                // Add the event handler on the main UI element
                ui_drag.ontap = function (ev) {
                    var target = ev.originalEvent.target || ev.originalEvent.srcElement;
                    if (target === ui_button) {
                        scrollPage(ev);
                    }
                };

                /* Add the event handler on window scrolling;
                 * Any manual scrolling should immediately disable
                 * the overlay (case for automatic scrolling, which
                 * also throws this event, should be included)
                 */
                window.addEventListener('scroll', function () { if (!in_scroll) { adjustOverlay(-1); } }, false);

                if (settings.menu) {

                    ui_drag.onhold = function (ev) {

                        // Fix for IE browsers
                        var target = ev.originalEvent.target || ev.originalEvent.srcElement;
                        if (target === ui_button) {

                            if (util.hasClass(ui_menu, 'open')) {
                                util.removeClass(ui_menu, 'open');
                                ui_menu.applyPrefs();
                            } else {
                                util.addClass(ui_menu, 'open');
                            }

                        }

                    };

                }

            };

            /* Prferences functions are shorthand access methods
             * for reading from cookie and saving to cookie. Used to
             * persist settings between pages and reloads.
             */
            preferences = {
                'get': function (key) {
                    var i, j, props, prefs = {};
                    props = document.cookie.split(';');
                    for (i = 0; i < props.length; i += 1) {
                        j = props[i].split('=');
                        prefs[j[0]] = j[1];
                    }
                    if (window.escape(key) in prefs) {
                        return prefs[key];
                    } else {
                        return null;
                    }
                },
                'set': function (key, val) {
                    document.cookie =
                        window.escape(key) + '=' +
                        window.escape(val);
                }
            };

            /* Big collection of utility functions used to simplify
             * the kind of stuff for which one would use jQuery, Prototype or
             * a lot of shims and polyfills.
             */
            util = {
                'hasClass': function (el, class_) {
                    var classes = el.className
                        .replace(/^\s+|\s+$/, '')
                        .replace(/\s+/, ' ')
                        .split(' ');
                    return (classes.indexOf(class_) !== -1);
                },
                'addClass': function (el, class_) {
                    var classes = el.className
                        .replace(/^\s+|\s+$/, '')
                        .replace(/\s+/, ' ')
                        .split(' ');
                    if (classes.indexOf(class_) === -1) {
                        classes.push(class_);
                    }
                    el.className = classes.join(' ');
                },
                'removeClass': function (el, class_) {
                    var classes = el.className
                        .replace(/^\s+|\s+$/, '')
                        .replace(/\s+/, ' ')
                        .split(' ');
                    if (classes.indexOf(class_) !== -1) {
                        classes.splice(classes.indexOf(class_), 1);
                    }
                    el.className = classes.join(' ');
                },

                'element': function (html) {
                    var el = document.createElement('div');
                    el.innerHTML = html;
                    return el.removeChild(el.childNodes[0]);
                },
                'position': {
                    'getX': function () {

                        var val;

                        if (window.pageXOffset) {
                            val = window.pageXOffset;
                        } else if (document.documentElement && document.documentElement.scrollLeft) {
                            val = document.documentElement.scrollLeft;
                        } else if (document.body.scrollLeft) {
                            val = document.body.scrollLeft;
                        } else {
                            val = 0;
                        }

                        return val;

                    },
                    'getY': function () {

                        var val;

                        if (window.pageYOffset) {
                            val = window.pageYOffset;
                        } else if (document.documentElement && document.documentElement.scrollTop) {
                            val = document.documentElement.scrollTop;
                        } else if (document.body.scrollTop) {
                            val = document.body.scrollTop;
                        } else {
                            val = 0;
                        }

                        return val;

                    }
                }
            };

            if (!!window.addEventListener) {
                util.handle = function (el, ev, func, bubble) {
                    if (typeof bubble === 'undefined') { bubble = false; }
                    el.addEventListener(ev, func, bubble);
                };
                util.unhandle = function (el, ev, func, bubble) {
                    if ((typeof func !== 'undefined') && (typeof bubble !== 'undefined')) {
                        el.removeEventListener(ev, func, bubble);
                    } else if (typeof func !== 'undefined') {
                        el.removeEventListener(ev, func);
                    } else {
                        el.removeEventListener(ev);
                    }
                };
            } else if (!!window.attachEvent) {
                util.handle = function (el, ev, func) {
                    el.attachEvent('on' + ev, func);
                };
                util.unhandle = function (el, ev, func) {
                    if (typeof func !== 'undefined') {
                        el.detachEvent('on' + ev, func);
                    } else {
                        el.detachEvent('on' + ev);
                    }
                };
            } else {
                util.handle = function (el, ev, func) {
                    el['on' + ev] = func;
                };
                util.unhandle = function (el, ev) {
                    el['on' + ev] = null;
                };
            }

            return mobileScroll;

        });
    }(typeof define === 'function' ? define : function () {
        if (typeof module !== 'undefined') { module.exports = arguments[2](); }
        else { window.mobileScroll = arguments[2](); }
    }));

}());