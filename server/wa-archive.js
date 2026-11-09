// JXA, run by server/archive.ts: osascript -l JavaScript wa-archive.js "<exact chat name>" [dry]
// Archives one chat in WhatsApp Desktop through Accessibility, the way the owner would: search by name,
// open the only exact match, check the header shows that name, then Chat > Archive. Opening it marks it read.
// Anything unexpected (no match, several, another header) is a SKIP: nothing is archived.
// biome-ignore lint/correctness/noUnusedVariables: osascript calls run()
function run(argv) {
	let step = "start";
	try {
		return main(argv[0], argv[1] === "dry", (x) => {
			step = x;
		});
	} catch (e) {
		return `ERR ${step}: ${e}`;
	}
}

function main(name, dry, at) {
	const LRM = "‎"; // WhatsApp prefixes its own labels with it; chat names don't have it
	const se = Application("System Events");
	const p = se.processes.byName("WhatsApp");
	at("activate");
	Application("WhatsApp").activate();
	delay(0.4);
	se.keyCode(53); // close a sheet or info panel left open
	delay(0.3);
	const w = p.windows[0];
	const find = (role, ok) =>
		w.entireContents().filter((e) => {
			try {
				return e.role() === role && ok(String(e.description() || ""));
			} catch {
				return false;
			}
		});
	const menu = (bar, item) =>
		p.menuBars[0].menuBarItems.byName(bar).menus[0].menuItems.byName(item);

	at("search");
	menu("File", `${LRM}Search`).click();
	delay(0.4);
	se.keystroke("a", { using: "command down" });
	se.keyCode(51);
	const app = Application.currentApplication();
	app.includeStandardAdditions = true;
	app.setTheClipboardTo(name);
	se.keystroke("v", { using: "command down" });
	delay(1.5);

	at("match");
	const hits = find("AXButton", (d) => d === name);
	const clear = () => {
		se.keyCode(53);
		delay(0.2);
	};
	if (hits.length !== 1) {
		clear();
		return `SKIP ${hits.length} exact matches`;
	}
	hits[0].actions.byName("AXPress").perform();
	delay(1.2);
	se.keyCode(53); // the press can open the group's info panel too
	delay(0.4);

	at("header");
	if (!find("AXHeading", (d) => d === name).length) {
		clear();
		return "SKIP header is another chat";
	}
	if (dry) {
		clear();
		return "DRY ok";
	}
	at("archive");
	const item = menu(`${LRM}Chat`, `${LRM}Archive`);
	if (!item.enabled()) {
		clear();
		return "SKIP archive disabled (already archived?)";
	}
	item.click();
	delay(1);
	clear();
	return "ARCHIVED";
}
