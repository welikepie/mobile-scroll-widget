var mobile_scroll = (function () {

	"use strict";

	var settings, init,
	    ui_node, styling_node;

	settings = {
		"ui": '<button class="mobile-scroll" type="button">Scroll Down</button>',
		"styling": 'body > button.mobile-scroll { position: fixed; bottom: 0; right: 0; padding: 20px; }'
	};

	init = function(runtime_settings) {
	
		// Overwrite the default settings with the ones provided
		// during the initialization.
		if (typeof runtime_settings === "object" && runtime_settings) {
			for (var prop in runtime_settings) {
				if (runtime_settings.hasOwnProperty(prop)) {
					options[prop] = runtime_settings[prop];
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
	
	};
	
	return init;

}());