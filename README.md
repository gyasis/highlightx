---
noteId: "e750f3d0486e11f08b8cf32d57ce7e4d"
tags: []

---

# Highlighter Decorator

A modern, customizable text highlighting component with sidebar support. Available as both a JavaScript class and TypeScript decorators.

## Features

- Split-screen layout with content and sidebar
- Multiple text highlighting support
- Customizable highlight colors and animations
- Sidebar with highlighted text snippets
- Clear all highlights functionality
- Modern, clean styling with smooth animations
- TypeScript decorator support
- Web Component support

## User Guide

### Toolbar
- The toolbar appears when highlight mode is active and you hover over the pin icon or the toolbar itself, or immediately after making a highlight.
- The toolbar provides navigation, search, export/import, notes, and sidebar controls.
- The toolbar auto-hides after a few seconds if not hovered.

### Removing Highlights
- To remove a highlight, **double-click the superscript number** that appears above the highlighted text. This will remove only that specific highlight.
- Double-clicking the highlighted text itself will not remove the highlight.

### Notes Panel
- If enabled, you can add notes to each highlight.
- Click the notes button (
) in the toolbar to open the notes panel.
- Each highlight will have a corresponding note field.

### Sidebar
- If enabled, click the sidebar button (
) in the toolbar to open the sidebar.
- The sidebar lists all highlights, their metadata, and any notes.
- Click a highlight entry in the sidebar to scroll to and focus that highlight in the content.

### Programmatic Access
- You can access all highlights programmatically via the `.highlights` property of the `HighlighterDecorator` instance.
- Each highlight object has the following structure:
  ```js
  {
    element: HTMLElement, // The DOM element for the highlight
    text: string,         // The highlighted text
    number: number,       // The highlight number
    timestamp: string,    // ISO timestamp of creation
    username: string,     // Username (if set)
    metadata: object,     // Metadata (e.g., page info)
    note: string          // (Optional) Note text
  }
  ```
- You can also use methods like `clearHighlights()`, `removeHighlightByNumber(number)`, and access navigation/search features via the toolbar or programmatically.

## Installation & Usage

### TypeScript Setup

1. Install the package:
```bash
npm install highlighter-decorator
```

2. Enable decorator support in your `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react",
    "declaration": true,
    "strict": true
  }
}
```

### Usage with TypeScript Decorators

1. Property Decorator:
```typescript
import { Highlightable } from 'highlighter-decorator';

class MyComponent {
    @Highlightable({
        pinColor: '#3b82f6',
        highlightColor: 'rgba(59, 130, 246, 0.2)'
    })
    contentDiv: HTMLElement;

    constructor() {
        this.contentDiv = document.getElementById('content')!;
    }
}
```

2. Component Decorator:
```typescript
import { HighlightableComponent } from 'highlighter-decorator';

@HighlightableComponent({
    pinColor: '#3b82f6',
    highlightColor: 'rgba(59, 130, 246, 0.2)'
})
class HighlightableSection extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<p>This entire component is highlightable!</p>`;
    }
}

customElements.define('highlightable-section', HighlightableSection);
```

### Usage with JavaScript

1. Direct Import:
```html
<script type="module">
    import { HighlighterDecorator } from 'highlighter-decorator';
    
    const element = document.getElementById('content');
    new HighlighterDecorator(element, {
        pinColor: '#3b82f6',
        highlightColor: 'rgba(59, 130, 246, 0.2)'
    });
</script>
```

2. Web Component:
```html
<highlighter-decorator>
    <div>Your content here...</div>
</highlighter-decorator>
```

## Configuration Options

```typescript
interface HighlightableOptions {
    pinColor?: string;           // Color of the pin button
    highlightColor?: string;     // Color of the highlights
    buttonText?: string;         // Text for the highlight button
    pinSize?: number;           // Size of the pin in pixels
    pinPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}
```

## Browser Requirements

Works in all modern browsers that support:
- ES6 Modules
- Web Components
- CSS Flexbox
- TypeScript Decorators (when using decorator syntax)

## Development

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Build the package:
```bash
npm run build
```
4. Run TypeScript compiler:
```bash
npm run tsc
```

## Examples

Check the `examples` directory for:
- TypeScript decorator usage
- JavaScript class usage
- Web Component implementation
- Mobile-optimized examples

## License