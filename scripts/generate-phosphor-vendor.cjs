// One-time generator: src/vendor/phosphor.css (run manually if the
// @phosphor-icons/web version bumps).
const fs = require("fs");
const css = fs.readFileSync("node_modules/@phosphor-icons/web/src/regular/style.css", "utf8");
const start = css.indexOf(".ph-");
if (start < 0) throw new Error("glyph classes not found");
const classes = css.slice(start);
const header = `/* Vendored from @phosphor-icons/web (regular): glyph class definitions as-is.
   The @font-face points to local copies of the woff2/woff binaries so vite
   inlines them into the single-file build (no external svg/ttf fallback). */
@font-face {
  font-family: "Phosphor";
  src: url("./fonts/Phosphor.woff2") format("woff2"),
       url("./fonts/Phosphor.woff") format("woff");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`;
fs.writeFileSync("src/vendor/phosphor.css", header + classes);
fs.mkdirSync("src/vendor/fonts", { recursive: true });
fs.copyFileSync("node_modules/@phosphor-icons/web/src/regular/Phosphor.woff2", "src/vendor/fonts/Phosphor.woff2");
fs.copyFileSync("node_modules/@phosphor-icons/web/src/regular/Phosphor.woff", "src/vendor/fonts/Phosphor.woff");
console.log("written, css size", (header + classes).length);
