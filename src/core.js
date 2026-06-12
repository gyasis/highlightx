// highlightx core — framework-agnostic, DOM-free highlight logic.
//
// This is the shared engine the constitution talks about: the LIB owns how text
// is split into highlightable segments and how a selection maps to offsets; the
// APP (vanilla HighlighterDecorator, or a Svelte/React renderer) decides how to
// paint those segments. No DOM ownership here — pure data in, pure data out.

/**
 * Split `text` into flat segments given highlights as character-offset records.
 * Overlap is first-class: a character covered by N highlights yields ONE segment
 * listing all N numbers. Each segment also reports which highlights END at its
 * right edge (where an inline marker should be dropped).
 *
 * @param {string} text
 * @param {Array<{number:number,start:number,end:number}>} highlights
 * @returns {Array<{text:string, numbers:number[], ending:number[]}>}
 *   numbers  - highlight numbers covering this segment (empty = plain text)
 *   ending   - highlight numbers whose end falls at this segment's right edge
 */
export function computeSegments(text, highlights) {
  if (!highlights || !highlights.length) return [{ text, numbers: [], ending: [] }];
  const len = text.length;
  const bounds = new Set([0, len]);
  for (const h of highlights) {
    if (h.start > 0 && h.start < len) bounds.add(h.start);
    if (h.end > 0 && h.end < len) bounds.add(h.end);
  }
  const sorted = [...bounds].sort((a, b) => a - b);
  const segs = [];
  for (let k = 0; k < sorted.length - 1; k++) {
    const a = sorted[k], b = sorted[k + 1];
    const covering = highlights.filter(h => h.start <= a && h.end >= b);
    const ending = highlights.filter(h => h.end === b).sort((x, y) => x.number - y.number).map(h => h.number);
    segs.push({ text: text.slice(a, b), numbers: covering.map(h => h.number), ending });
  }
  return segs;
}

/**
 * Of the highlights covering a point, the "most specific" is the shortest span —
 * used to resolve a click on an overlapped region to a single highlight.
 * @param {Array<{number:number,start:number,end:number}>} covering
 * @returns {object|null}
 */
export function mostSpecific(covering) {
  if (!covering || !covering.length) return null;
  return covering.slice().sort((x, y) => (x.end - x.start) - (y.end - y.start))[0];
}

/**
 * Map a DOM (container, offset) point to a character offset in `rootEl`'s text,
 * counting only real content — never the digits inside inserted number markers.
 * Works whether or not the content already has highlight markup.
 *
 * @param {Element} rootEl              the highlightable region element
 * @param {Node} container             selection point container
 * @param {number} offset              selection point offset
 * @param {string} numberClassName     class on marker elements to skip (e.g. 'highlight-number')
 * @returns {number} base character offset
 */
export function pointToOffset(rootEl, container, offset, numberClassName = 'highlight-number') {
  const doc = rootEl.ownerDocument;
  const pre = doc.createRange();
  pre.selectNodeContents(rootEl);
  try { pre.setEnd(container, offset); } catch (e) { return rootEl.textContent.length; }
  const frag = pre.cloneContents();
  const w = doc.createTreeWalker(frag, 4 /* SHOW_TEXT */);
  let count = 0, n;
  while ((n = w.nextNode())) {
    let el = n.parentElement, marker = false;
    while (el) { if (el.classList && el.classList.contains(numberClassName)) { marker = true; break; } el = el.parentElement; }
    if (!marker) count += n.nodeValue.length;
  }
  return count;
}

/**
 * Trim leading/trailing whitespace off a [start,end) range so highlights sit on
 * real text and end-markers never land in inter-block whitespace.
 * @returns {[number, number]} trimmed [start, end]
 */
export function trimRange(text, start, end) {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return [start, end];
}
