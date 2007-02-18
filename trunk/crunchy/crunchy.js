(function() { return this; })().Crunchy = {}

// TODO: Make better use of Crunchy.error
Crunchy.error = function(x) {
	console.error(x);
}

Crunchy.crunch = function(x, settings) {
	// Yes, this is crap:
	// (Maybe I should merge oldSettings and settings....)
	// (Well, really I shouldn't do it this was at all)
	if(settings) {
		var oldSettings = Crunchy.settings;
		Crunchy.settings = settings;
	}

	try {
		var root = Crunchy.parse(x);
		Crunchy.runHooks(root);
		Crunchy.renameVariables(root);
		var crunched = Crunchy.write(root);

		var minimized = pack(
				crunched,
				0,
				true,
				true);

		var packed = pack(
				crunched,
				62,    // 0 = None, 10 = Numeric, 62 = Normal, 95 = High ASCII
				true,  // Fast Decode
				true   // SpecialChars... ;;; won't work, so I do it in crunchy instead.
				);
		return minimized.length < packed.length ? minimized : packed;
	}
	finally {
		if(settings) Crunchy.settings = oldSettings;
	}
}

load("common.js")
load("jsdefs.js")
load("tokenizer.js");
load("jsparse.js")
load("crunch.js")
load("renameVariables.js")
load("write.js")

load("../packer/ParseMaster.js");
load("../packer/pack.js");
