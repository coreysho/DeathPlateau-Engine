// WHICH FIVE-CHARACTER MARKERS THIS ENGINE TREATS AS A CHAT ICON, printed as JSON.
//
//   npx tsx tools/icontags.ts cr1 cra crb        one line of JSON: {"cr1":true,...}
//   npx tsx tools/icontags.ts                    every candidate worth asking about
//
// WHY A TOOL AND NOT A TEST. The answer has to match the client's ChatIcons.iconAt exactly, and
// the two live in different repositories: the engine measures a line's width and decides where to
// wrap it, the client draws the icon. When they disagree the server wraps at a width the client
// does not draw, AND split carries the unrecognised marker onto continuation lines as if it were a
// colour - a second icon at the front of every wrapped line. 'a', the tenth icon, was missing here
// for exactly that reason.
//
// So this prints the engine's half of the contract and the client's run_chaticontest.py compares it
// against its own, which is the only place both halves exist at once. Nothing here asserts: a tool
// that answers is more use to the other side than a test that passes on its own.
import FontType from '#/cache/config/FontType.js';

// 'cr' with every digit and the first few letters - the digits are the nine, 'a' is the tenth, and
// 'b' onwards is what an eleventh would be, so a disagreement about where the run ends shows up
// here rather than when somebody adds one. Plus the tags that are NOT icons and must not become
// them: a colour, the shadow switches, the reset, and the wrong shapes either side of three.
const CANDIDATES = [
    ...'0123456789abcdef'.split('').map(c => `cr${c}`),
    'col',
    'sh0',
    'sh1',
    'str',
    'cr',
    'cr12',
    'CR1',
    'c1'
];

const asked = process.argv.slice(2);
const tags = asked.length > 0 ? asked : CANDIDATES;
const out: Record<string, boolean> = {};
for (const tag of tags) {
    out[tag] = FontType.isIconTag(tag);
}
console.log(JSON.stringify(out));
