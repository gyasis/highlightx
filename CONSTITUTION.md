# highlightx — Constitution (the lib ⇄ app contract)

This document is the governing contract between **highlightx** (the engine) and any
**app** that consumes it (the quiz, future apps). It exists so apps never fork the
engine to get app-specific behavior.

> One sentence: **the lib highlights; what happens with a highlight is the app's decision.**

---

## I. The lib OWNS the mechanics (never the app's decisions)

highlightx is solely responsible for:

- turning a selection / long-press into a `<mark>` wrapped node + a numbered marker
- the `.highlights` model, numbering, remove-by-number, clear-all
- a stable DOM with stable hooks: `.highlight-wrapper`, `.highlight-content`,
  and the number element (`.highlight-number`)

The lib must **not** hard-code what a click does, how the number is themed, where
highlights are stored, or which surrounding UI is shown. Those are app decisions
(Section III).

## II. The lib EXPOSES (so apps extend without forking)

### Presentation
- CSS variables: `--highlight-color`, `--superscript-color`, `--pin-color`, `--pin-size`
- restyleable classes: `.highlight-content`, `.highlight-number`
- **`numberTag`** (default `'sup'`) — the marker element tag. Default is an inline
  `<sup>` that **flows with the text** (no absolute badge that overlaps the line above).
- **`numberClassName`** (default `'highlight-number'`)
- **`renderNumber(number, highlight)`** — optional, returns an `HTMLElement` to fully
  replace the marker.

### Behavior callbacks (the app decides)
- **`onHighlightClick(highlight)`** — fired when the **mark** is clicked. If provided,
  the engine defers to it (does not run its own navigate). *This is the hook the quiz
  uses to open the Tutor mini-lesson.*
- **`onHighlightAdd(highlight)`**
- **`onHighlightRemove(number)`**
- **`onChange(highlights)`** — fired after any add/remove/clear; the app persists here
  (e.g. per-language localStorage). Not fired when an import is about to repopulate.

### Hydration
- `loadHighlightsFromData(data)` / `saveHighlights()` / export-import — for restoring a
  saved set. (Restoring onto freshly-rendered text is the app-integration concern in
  Section IV.)

### UI opt-out
- `enableSidebar`, `enableNotes`, `enableNavigation`, `enableSearch`,
  `enableKeyboardShortcuts` — set any to `false` so the app supplies its own UI.

### Built-in interaction defaults (overridable by the above)
- **mark** single-click → `onHighlightClick` (or internal navigate if no callback)
- **number** single-click → inert (won't double-fire the mark action)
- **number** double-click → remove that highlight

## III. The app DECIDES (the extension layer)

A consuming app layers its behavior on the callbacks — it never edits the engine:

| App concern | How |
|---|---|
| what a click does | `onHighlightClick` |
| how the number looks | `numberTag` / `numberClassName` / `renderNumber` + CSS vars |
| persistence (e.g. per-language) | `onChange` + hydration |
| surrounding UI | `enable*: false` + the app's own components |

## IV. Reference consumer — the SSM quiz

The quiz mounts the engine on the question container with the built-in chrome **off**,
and supplies its own extension layer:

```js
new HighlighterDecorator(questionEl, {
  enableSidebar: false, enableNotes: false, enableNavigation: false,
  numberTag: 'sup',                                  // inline number (default)
  onHighlightClick: (h) => showLesson(qid, lang, cleanTerm(h.text)), // → Tutor
  onChange:        (hs) => saveForLang(qid, lang, hs),               // → per-language localStorage
});
// on question/lang switch: hydrate from loadForLang(qid, lang)
```

The quiz keeps its own floating pen + LessonPanel chips as its UI; the engine only owns
highlight + number creation.

**Open integration concern:** restoring saved highlights onto freshly-rendered question
text (text-offset re-matching) on question/language switch. May warrant a
`loadHighlights(savedArray, { matchBy: 'text' })` helper in the lib. Also: `highlight.text`
includes the trailing superscript digit — the app should strip it (`stripSuperscripts`)
before using the term.

## V. Amending this constitution

Changes that add new callbacks/options are additive and backward-compatible — preferred.
Changes that alter a default (like the `numberTag: 'sup'` switch from the old absolute
badge) must be recorded here with the reason. The absolute-badge marker was removed
because its `position:absolute` placement broke text flow and overlapped the line above.
