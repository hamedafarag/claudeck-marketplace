// Catch-all no-op module for unhandled Claudeck imports in the showcase.
// Plugins that import from paths like /js/core/dom.js or /js/core/events.js
// will get this empty module instead of a 404.
export default {};
export const $ = {};
