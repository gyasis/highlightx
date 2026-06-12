export class HighlighterDecorator {
    constructor(element, options = {}) {
        this.element = element;
        this.highlights = [];
        this.highlightCount = 0; // Track number of highlights
        this.options = {
            pinColor: '#10b981',
            highlightColor: 'rgba(16, 185, 129, 0.2)',
            buttonText: 'Highlight Selection',
            pinSize: this.isTouchDevice() ? 40 : 32,
            pinPosition: 'bottom-right',
            superscriptColor: '#10b981', // Color for the superscript number
            showNumbers: true,
            // --- number presentation (constitution: lib renders, app may override) ---
            numberTag: 'sup',                 // inline <sup> by default — flows with text, no absolute-badge overlap
            numberClassName: 'highlight-number',
            renderNumber: null,               // optional (number, highlight?) => HTMLElement — full app override of the marker
            // --- app extension callbacks (constitution: app decides behavior) ---
            onHighlightClick: null,           // (highlight) => void   — e.g. quiz opens the Tutor mini-lesson
            onHighlightAdd: null,             // (highlight) => void
            onHighlightRemove: null,          // (number) => void
            onChange: null,                   // (highlights) => void  — app persists (e.g. per-language localStorage)
            enableNavigation: true,
            enableKeyboardShortcuts: true,
            enableSearch: true,
            enableNotes: true,
            enableSidebar: true,
            shortcutModifier: 'Alt',
            username: 'Anonymous', // Placeholder for future auth
            ...options
        };

        // Set CSS variables for per-instance colors
        this.element.style.setProperty('--highlight-color', this.options.highlightColor);
        this.element.style.setProperty('--pin-color', this.options.pinColor);
        this.element.style.setProperty('--superscript-color', this.options.superscriptColor);
        this.element.style.setProperty('--pin-size', this.options.pinSize + 'px');

        this.currentHighlightIndex = -1;
        this.searchResults = [];
        this.searchIndex = -1;
        this.metadata = {
            url: window.location.href,
            title: document.title,
            path: this.getElementPath(element)
        };
        this._toolbarHideTimeout = null;
        this._toolbarHovering = false;
        this._toolbarLongHoverTimeout = null;
        this._highlightMode = false;
        this._highlightListener = null;
        this.init();
    }

    isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    }

    init() {
        this.setupContainer();
        this.setupPin();
        this.setupControls();
        this.setupStyles();
        this.setupTouchBehavior();
        this.setupKeyboardShortcuts();
        this.loadSavedHighlights();
    }

    setupContainer() {
        if (getComputedStyle(this.element).position === 'static') {
            this.element.style.position = 'relative';
        }
        this._captureBase();
    }

    // Snapshot the pristine content ONCE — the offset model re-renders from this
    // on every change, so overlapping highlights never corrupt the source text.
    _captureBase() {
        this._baseHTML = this.element.innerHTML;
        const tmp = document.createElement('div');
        tmp.innerHTML = this._baseHTML;
        const w = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
        let s = '', n; while ((n = w.nextNode())) s += n.nodeValue;
        this._baseText = s;
    }

    // Map a (container, offset) point in the CURRENT (possibly highlighted) DOM to a
    // character offset in the pristine base text — counting only real content, never
    // the inserted superscript marker digits.
    _pointToBaseOffset(container, offset) {
        const pre = document.createRange();
        pre.selectNodeContents(this.element);
        try { pre.setEnd(container, offset); } catch (e) { return this._baseText.length; }
        const frag = pre.cloneContents();
        const w = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
        let count = 0, n;
        while ((n = w.nextNode())) {
            let el = n.parentElement, marker = false;
            while (el) { if (el.classList && el.classList.contains(this.options.numberClassName)) { marker = true; break; } el = el.parentElement; }
            if (!marker) count += n.nodeValue.length;
        }
        return count;
    }

    setupPin() {
        this.pin = document.createElement('div');
        this.pin.className = 'highlighter-pin';
        this.element.appendChild(this.pin);

        // Add touch feedback
        this.pin.addEventListener('touchstart', () => {
            this.pin.style.transform = 'scale(0.95)';
        }, { passive: true });

        this.pin.addEventListener('touchend', () => {
            this.pin.style.transform = '';
        }, { passive: true });

        // Click pin to enable highlight mode (no highlight button needed)
        this.pin.addEventListener('click', () => {
            this.toggleHighlightMode();
        });

        // Double-click pin to clear all highlights
        this.pin.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.clearHighlights();
        });
    }

    setupControls() {
        this.controls = document.createElement('div');
        this.controls.className = 'highlighter-controls';
        
        // Add navigation and feature controls
        if (this.options.enableNavigation) {
            const controlsHTML = `
                <div class="highlighter-nav-controls">
                    <button class="nav-prev" disabled title="${this.options.shortcutModifier}+
</button>
                    <span class="nav-counter">0/0</span>
                    <button class="nav-next" disabled title="${this.options.shortcutModifier}+
</button>
                    <button class="toggle-numbers">Toggle Numbers</button>
                </div>
                ${this.options.enableSearch ? `
                    <div class="highlighter-search">
                        <input type="text" placeholder="Search highlights..." class="search-input">
                        <span class="search-counter"></span>
                    </div>
                ` : ''}
                <div class="highlighter-actions">
                    <button class="export-highlights" title="Export"></button>
                    <button class="import-highlights" title="Import"></button>
                    ${this.options.enableNotes ? '<button class="toggle-notes" title="Toggle Notes Panel"></button>' : ''}
                    ${this.options.enableSidebar ? '<button class="toggle-sidebar" title="Toggle Sidebar"></button>' : ''}
                </div>
            `;

            this.controls.innerHTML = controlsHTML;

            // Setup event listeners
            this.setupNavigationHandlers();
            this.setupSearchHandlers();
            this.setupExportImportHandlers();
            this.setupNotesHandlers();
            this.setupSidebarHandlers();
        }

        this.element.appendChild(this.controls);
        // Toolbar hover logic: only pin and controls
        this.pin.addEventListener('mouseenter', this._onToolbarMouseEnter.bind(this));
        this.pin.addEventListener('mouseleave', this._onToolbarMouseLeave.bind(this));
        this.controls.addEventListener('mouseenter', this._onToolbarMouseEnter.bind(this));
        this.controls.addEventListener('mouseleave', this._onToolbarMouseLeave.bind(this));
    }

    setupNavigationHandlers() {
        const navControls = this.controls.querySelector('.highlighter-nav-controls');
        if (!navControls) return;

        const prevBtn = navControls.querySelector('.nav-prev');
        const nextBtn = navControls.querySelector('.nav-next');
        const toggleBtn = navControls.querySelector('.toggle-numbers');

        prevBtn?.addEventListener('click', () => this.navigateHighlight('prev'));
        nextBtn?.addEventListener('click', () => this.navigateHighlight('next'));
        toggleBtn?.addEventListener('click', () => this.toggleNumbers());
    }

    setupSearchHandlers() {
        if (!this.options.enableSearch) return;

        const searchInput = this.controls.querySelector('.search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            this.searchResults = this.highlights.filter(h => 
                h.text.toLowerCase().includes(query)
            );
            this.searchIndex = -1;
            this.updateSearchCounter();
            
            if (this.searchResults.length > 0) {
                this.navigateSearch('next');
            }
        });
    }

    setupExportImportHandlers() {
        const exportBtn = this.controls.querySelector('.export-highlights');
        const importBtn = this.controls.querySelector('.import-highlights');

        exportBtn?.addEventListener('click', () => this.exportHighlights());
        importBtn?.addEventListener('click', () => this.importHighlights());
    }

    setupNotesHandlers() {
        if (!this.options.enableNotes) return;

        const toggleNotesBtn = this.controls.querySelector('.toggle-notes');
        toggleNotesBtn?.addEventListener('click', () => this.toggleNotesPanel());
    }

    setupSidebarHandlers() {
        if (!this.options.enableSidebar) return;

        const sidebarBtn = this.controls.querySelector('.toggle-sidebar');
        sidebarBtn?.addEventListener('click', () => this.toggleSidebar());
    }

    setupKeyboardShortcuts() {
        if (!this.options.enableKeyboardShortcuts) return;

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' && e.altKey) {
                e.preventDefault();
                this.navigateHighlight('prev');
            } else if (e.key === 'ArrowRight' && e.altKey) {
                e.preventDefault();
                this.navigateHighlight('next');
            } else if (e.key === 'n' && e.altKey && this.options.enableNotes) {
                e.preventDefault();
                this.toggleNotesPanel();
            }
        });
    }

    setupStyles() {
        const styleId = 'highlighter-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = this.generateStyles();
            document.head.appendChild(style);
        }
    }

    setupTouchBehavior() {
        if (this.isTouchDevice()) {
            // Improve touch selection
            this.element.addEventListener('touchstart', this.handleTouchStart.bind(this));
            this.element.addEventListener('touchend', this.handleTouchEnd.bind(this));
        }
    }

    handleTouchStart(e) {
        // Store touch start time for distinguishing between tap and selection
        this.touchStartTime = Date.now();
    }

    handleTouchEnd(e) {
        const touchDuration = Date.now() - this.touchStartTime;
        // If touch duration is short, it's likely a tap rather than selection
        if (touchDuration < 500) {
            return;
        }
        
        // Check if text was selected
        const selection = window.getSelection();
        if (!selection.isCollapsed) {
            this.showHighlightButton(e);
        }
    }

    // Touch has no hover toolbar, so a long-press selection commits the highlight
    // directly — mirrors the desktop mouseup path (only in highlight mode, same guard).
    showHighlightButton() {
        if (!this._highlightMode) return;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        if (!this.element.contains(selection.anchorNode)) return;
        const t = selection.toString().trim();
        if (t.split(/\s+/).length > 1 || t.length > 5) {
            this.highlightSelection();
        }
    }

    generateStyles() {
        return `
            .highlight-wrapper {
                position: relative;
                display: inline;
                white-space: pre-wrap;
                vertical-align: baseline;
            }

            /* Offset model: flat <mark> segments. One mark may belong to several
               highlights (data-hl="3 5"); overlap regions get a second tint layer. */
            .hl-mark {
                background-color: var(--highlight-color, ${this.options.highlightColor});
                box-decoration-break: clone;
                -webkit-box-decoration-break: clone;
                border-radius: 0.1em;
                color: inherit;
                cursor: pointer;
            }
            .hl-mark.hl-overlap {
                /* stack another tint so overlapping highlights read as deeper */
                box-shadow: inset 0 0 0 999px var(--highlight-color, ${this.options.highlightColor});
            }
            .hl-mark.active {
                box-shadow: 0 0 0 2px var(--pin-color, ${this.options.pinColor});
                border-radius: 0.2em;
            }
            /* highlights hidden when not in highlight mode */
            .hl-suppressed .hl-mark { background: transparent; box-shadow: none; }
            .hl-suppressed .${this.options.numberClassName} { display: none; }

            .highlight-number {
                /* Inline superscript — flows with the text (no absolute badge that
                   overlaps the line above). vertical-align handled by <sup>. */
                font-size: 0.62em;
                font-weight: 800;
                color: var(--superscript-color, ${this.options.superscriptColor});
                margin: 0 1px 0 3px;            /* a tad more space on the left */
                padding: 0 0.28em;
                border: 1px solid color-mix(in srgb, var(--superscript-color, ${this.options.superscriptColor}) 40%, transparent);
                border-radius: 0.45em;
                line-height: normal;
                user-select: none;
                cursor: pointer;
                display: ${this.options.showNumbers ? 'inline' : 'none'};
            }
            .highlight-number:hover { color: #ef4444; border-color: #ef4444; }

            .highlight-wrapper.active {
                outline: none;
            }

            .highlight-wrapper.active .highlight-content {
                box-shadow: 0 0 0 2px var(--pin-color, ${this.options.pinColor});
                border-radius: 0.2em;
            }

            .highlighter-pin {
                position: absolute;
                width: var(--pin-size, ${this.options.pinSize}px);
                height: var(--pin-size, ${this.options.pinSize}px);
                border-radius: 50%;
                background-color: var(--pin-color, ${this.options.pinColor});
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                z-index: 1000;
                opacity: 0.8;
                ${this.getPositionStyles()}
            }

            .highlighter-pin:hover,
            .highlighter-pin.active {
                opacity: 1;
                transform: scale(1.1);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }

            .highlighter-pin::before {
                content: "
";
                color: white;
                font-size: calc(var(--pin-size, ${this.options.pinSize}px) * 0.5);
                transition: transform 0.2s ease;
            }

            .highlighter-pin:hover::before {
                transform: rotate(-45deg);
            }

            .highlighter-controls {
                position: absolute;
                ${this.options.pinPosition.includes('bottom') ? 'bottom' : 'top'}: calc(var(--pin-size, ${this.options.pinSize}px) + 8px);
                ${this.options.pinPosition.includes('right') ? 'right' : 'left'}: 0;
                display: none;
                gap: 0.5rem;
                padding: 0.5rem;
                background: white;
                border-radius: 0.375rem;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 999;
            }

            .highlighter-controls.visible {
                display: flex;
            }

            /* Mobile optimizations */
            @media (hover: none) {
                .highlighter-pin {
                    opacity: 1;
                }

                .highlighter-pin:active {
                    transform: scale(0.95);
                }

                .highlighter-controls {
                    padding: 0.75rem;
                }
            }

            /* High contrast mode support */
            @media (prefers-contrast: high) {
                .highlighter-pin {
                    border: 2px solid #000;
                }
            }

            .highlighter-nav-controls {
                display: flex;
                gap: 0.5rem;
                align-items: center;
                margin-top: 0.5rem;
            }

            .highlighter-nav-controls button {
                padding: 0.25rem 0.5rem;
                background: var(--pin-color, ${this.options.pinColor});
                color: white;
                border: none;
                border-radius: 0.25rem;
                cursor: pointer;
                opacity: 0.8;
                transition: opacity 0.2s;
            }

            .highlighter-nav-controls button:hover {
                opacity: 1;
            }

            .highlighter-nav-controls button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .nav-counter {
                padding: 0.25rem 0.5rem;
                background: #f3f4f6;
                border-radius: 0.25rem;
                font-size: 0.875rem;
            }

            .highlighter-search {
                display: flex;
                gap: 0.5rem;
                align-items: center;
                margin-top: 0.5rem;
            }

            .search-input {
                padding: 0.25rem 0.5rem;
                border: 1px solid #e5e7eb;
                border-radius: 0.25rem;
                font-size: 0.875rem;
            }

            .search-counter {
                font-size: 0.75rem;
                color: #6b7280;
            }

            .highlighter-actions {
                display: flex;
                gap: 0.5rem;
                margin-top: 0.5rem;
            }

            .highlighter-actions button {
                padding: 0.25rem 0.5rem;
                background: var(--pin-color, ${this.options.pinColor});
                color: white;
                border: none;
                border-radius: 0.25rem;
                cursor: pointer;
                opacity: 0.8;
                transition: opacity 0.2s;
            }

            .notes-panel {
                position: fixed;
                right: 1rem;
                top: 1rem;
                width: 300px;
                max-height: 80vh;
                background: white;
                border-radius: 0.5rem;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                padding: 1rem;
                overflow-y: auto;
                z-index: 1001;
                display: none;
            }

            .notes-panel.visible {
                display: block;
            }

            .highlight-note {
                margin-top: 0.5rem;
                padding: 0.5rem;
                background: #f3f4f6;
                border-radius: 0.25rem;
            }

            .highlight-note textarea {
                width: 100%;
                min-height: 60px;
                margin-top: 0.25rem;
                padding: 0.25rem;
                border: 1px solid #e5e7eb;
                border-radius: 0.25rem;
                resize: vertical;
            }

            .highlighter-sidebar {
                position: fixed;
                right: 0;
                top: 0;
                width: 350px;
                height: 100vh;
                background: white;
                box-shadow: -2px 0 4px rgba(0,0,0,0.1);
                z-index: 1000;
                display: none;
                flex-direction: column;
                transition: transform 0.3s ease;
            }

            .highlighter-sidebar.visible {
                display: flex;
            }

            .sidebar-header {
                padding: 1rem;
                border-bottom: 1px solid #e5e7eb;
                background: var(--pin-color, ${this.options.pinColor});
                color: white;
            }

            .sidebar-content {
                flex: 1;
                overflow-y: auto;
                padding: 1rem;
            }

            .highlight-entry {
                margin-bottom: 1rem;
                padding: 1rem;
                background: #f9fafb;
                border-radius: 0.5rem;
                border-left: 3px solid var(--pin-color, ${this.options.pinColor});
            }

            .highlight-metadata {
                font-size: 0.75rem;
                color: #6b7280;
                margin-bottom: 0.5rem;
            }

            .highlight-text {
                font-size: 0.875rem;
                margin-bottom: 0.5rem;
                line-height: 1.5;
            }

            .highlight-note-preview {
                font-size: 0.875rem;
                color: #4b5563;
                font-style: italic;
                padding: 0.5rem;
                background: #f3f4f6;
                border-radius: 0.25rem;
                margin-top: 0.5rem;
            }
        `;
    }

    getPositionStyles() {
        const margin = 8;
        const { pinPosition } = this.options;
        switch (pinPosition) {
            case 'bottom-right':
                return `bottom: ${margin}px; right: ${margin}px;`;
            case 'bottom-left':
                return `bottom: ${margin}px; left: ${margin}px;`;
            case 'top-right':
                return `top: ${margin}px; right: ${margin}px;`;
            case 'top-left':
                return `top: ${margin}px; left: ${margin}px;`;
            default:
                return `bottom: ${margin}px; right: ${margin}px;`;
        }
    }

    toggleHighlightMode() {
        this._highlightMode = !this._highlightMode;
        if (this._highlightMode) {
            this.showToolbar(true);
            this.showHighlights();
            // Auto-hide toolbar after 3s unless hovered
            this._toolbarHideTimeout = setTimeout(() => {
                if (!this._toolbarHovering) this.hideToolbar();
            }, 3000);
            // Add mouseup listener for highlighting
            this._highlightListener = (e) => {
                const selection = window.getSelection();
                if (
                    selection &&
                    !selection.isCollapsed &&
                    this.element.contains(selection.anchorNode)
                ) {
                    // Prevent accidental highlight on double-click word selection
                    const selectedText = selection.toString();
                    // Only highlight if more than one word or more than 5 characters
                    if (selectedText.trim().split(/\s+/).length > 1 || selectedText.trim().length > 5) {
                        this.highlightSelection();
                    }
                }
            };
            document.addEventListener('mouseup', this._highlightListener);
        } else {
            this.hideToolbar();
            // NOTE: highlights stay visible when mode is off — they're persistent
            // annotations. Mode only gates *creating* new highlights.
            // Remove mouseup listener
            if (this._highlightListener) {
                document.removeEventListener('mouseup', this._highlightListener);
                this._highlightListener = null;
            }
        }
    }

    showToolbar(immediate = false) {
        if (this.controls) {
            this.controls.classList.add('visible');
            if (this._toolbarHideTimeout) clearTimeout(this._toolbarHideTimeout);
            if (!immediate) {
                // Hide after 3s unless hovered
                this._toolbarHideTimeout = setTimeout(() => {
                    if (!this._toolbarHovering) this.hideToolbar();
                }, 3000);
            }
        }
    }

    hideToolbar() {
        if (this.controls) {
            this.controls.classList.remove('visible');
        }
        if (this._toolbarHideTimeout) {
            clearTimeout(this._toolbarHideTimeout);
            this._toolbarHideTimeout = null;
        }
    }

    _onToolbarMouseEnter() {
        if (this._highlightMode) {
            this._toolbarHovering = true;
            // Show toolbar on long hover (500ms)
            if (this._toolbarLongHoverTimeout) clearTimeout(this._toolbarLongHoverTimeout);
            this._toolbarLongHoverTimeout = setTimeout(() => {
                if (this._toolbarHovering) this.showToolbar(true);
            }, 500);
        }
    }

    _onToolbarMouseLeave() {
        this._toolbarHovering = false;
        if (this._toolbarLongHoverTimeout) {
            clearTimeout(this._toolbarLongHoverTimeout);
            this._toolbarLongHoverTimeout = null;
        }
        if (this._highlightMode) {
            // Hide toolbar after 3s if not hovered
            if (this._toolbarHideTimeout) clearTimeout(this._toolbarHideTimeout);
            this._toolbarHideTimeout = setTimeout(() => {
                if (!this._toolbarHovering) this.hideToolbar();
            }, 3000);
        }
    }

    showHighlights() {
        this.element.classList.remove('hl-suppressed');
    }

    hideHighlights() {
        this.element.classList.add('hl-suppressed');
    }

    highlightSelection() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (!this.element.contains(range.commonAncestorContainer)) return;
        if (this._baseHTML == null) this._captureBase();

        // Offset model: map the selection to base character offsets. Overlap is fine —
        // each highlight is an independent {number,start,end} record over the base text.
        let start = this._pointToBaseOffset(range.startContainer, range.startOffset);
        let end = this._pointToBaseOffset(range.endContainer, range.endOffset);
        if (end < start) { const t = start; start = end; end = t; }
        // Trim whitespace at both ends: keeps the highlight on real text and, crucially,
        // keeps the end marker out of inter-paragraph whitespace (which would drop the
        // <sup> onto its own line between blocks).
        while (start < end && /\s/.test(this._baseText[start])) start++;
        while (end > start && /\s/.test(this._baseText[end - 1])) end--;
        if (end - start < 1) return;

        this.highlightCount++;
        const h = {
            number: this.highlightCount,
            start, end,
            text: this._baseText.slice(start, end),
            timestamp: new Date().toISOString(),
            username: this.options.username,
            metadata: { ...this.metadata }
        };
        this.highlights.push(h);
        selection.removeAllRanges();

        this.renderHighlights();
        this.updateNavigationControls();
        this.updateSidebar();
        if (this._highlightMode) this.showToolbar(true);
        this.options.onHighlightAdd?.(h);
        this._emitChange();
    }

    // Re-render the highlight layer from the pristine base, overlaying flat segments.
    // A character range covered by N highlights becomes ONE <mark> listing all N
    // numbers (overlap blends), and each highlight drops an inline <sup> at its end.
    renderHighlights() {
        if (this._baseHTML == null) this._captureBase();
        this.element.innerHTML = this._baseHTML;
        // The pin + toolbar live INSIDE this.element but aren't in the base snapshot,
        // so the innerHTML reset just removed them — re-attach (same nodes, listeners
        // intact) or the pin vanishes after the first highlight and mode can't toggle.
        if (this.pin) this.element.appendChild(this.pin);
        if (this.controls) this.element.appendChild(this.controls);
        this.highlights.forEach(h => { h.element = null; });
        if (!this.highlights.length) return;

        const text = this._baseText;
        // Map pristine text nodes to their base offsets.
        const walker = document.createTreeWalker(this.element, NodeFilter.SHOW_TEXT);
        const tnodes = []; let pos = 0, n;
        while ((n = walker.nextNode())) { tnodes.push({ node: n, start: pos, end: pos + n.nodeValue.length }); pos += n.nodeValue.length; }

        // Edit nodes back-to-front so earlier offsets stay valid.
        for (let ti = tnodes.length - 1; ti >= 0; ti--) {
            const { node, start: ns, end: ne } = tnodes[ti];
            const bounds = new Set([ns, ne]);
            for (const h of this.highlights) {
                if (h.start > ns && h.start < ne) bounds.add(h.start);
                if (h.end > ns && h.end < ne) bounds.add(h.end);
            }
            const sorted = [...bounds].sort((a, b) => a - b);
            const frag = document.createDocumentFragment();
            for (let k = 0; k < sorted.length - 1; k++) {
                const a = sorted[k], b = sorted[k + 1];
                const seg = text.slice(a, b);
                const covering = this.highlights.filter(h => h.start <= a && h.end >= b);
                if (covering.length) {
                    const mark = document.createElement('mark');
                    mark.className = 'hl-mark' + (covering.length > 1 ? ' hl-overlap' : '');
                    mark.setAttribute('data-hl', covering.map(h => h.number).join(' '));
                    mark.textContent = seg;
                    mark.addEventListener('click', () => {
                        // most-specific (smallest) covering highlight wins the click
                        const most = covering.slice().sort((x, y) => (x.end - x.start) - (y.end - y.start))[0];
                        this.handleHighlightClick(most.number);
                    });
                    covering.forEach(h => { if (!h.element) h.element = mark; });
                    frag.appendChild(mark);
                } else {
                    frag.appendChild(document.createTextNode(seg));
                }
                // Drop end-markers for highlights that end exactly here.
                const ending = this.highlights.filter(h => h.end === b).sort((x, y) => x.number - y.number);
                for (const h of ending) {
                    const sup = this.options.renderNumber
                        ? this.options.renderNumber(h.number, h)
                        : document.createElement(this.options.numberTag);
                    if (!this.options.renderNumber) { sup.textContent = h.number; sup.className = this.options.numberClassName; }
                    sup.setAttribute('data-n', h.number);
                    sup.addEventListener('click', (e) => { e.stopPropagation(); });
                    sup.addEventListener('dblclick', (e) => { e.stopPropagation(); this.removeHighlightByNumber(h.number); });
                    frag.appendChild(sup);
                }
            }
            node.parentNode.replaceChild(frag, node);
        }
    }

    isComplexSelection(range) {
        try {
            // Try to clone the contents to check if it's a complex selection
            const fragment = range.cloneContents();
            // If there's more than one top-level node, it's complex
            return fragment.childNodes.length > 1 || 
                   fragment.firstChild.nodeType !== Node.TEXT_NODE;
        } catch (e) {
            return true; // If in doubt, treat it as complex
        }
    }

    handleHighlightClick(number) {
        const index = this.highlights.findIndex(h => h.number === number);
        if (index === -1) return;
        // Constitution: if the app handles clicks (e.g. open a Tutor lesson), defer to it.
        if (this.options.onHighlightClick) {
            this.options.onHighlightClick(this.highlights[index]);
            return;
        }
        this.navigateToHighlight(index);
    }

    // Fire the app's onChange with the current highlight set (constitution: app persists).
    _emitChange() {
        this.options.onChange?.(this.highlights);
    }

    navigateHighlight(direction) {
        const total = this.highlights.length;
        if (total === 0) return;

        if (direction === 'next') {
            this.currentHighlightIndex = (this.currentHighlightIndex + 1) % total;
        } else {
            this.currentHighlightIndex = (this.currentHighlightIndex - 1 + total) % total;
        }

        this.navigateToHighlight(this.currentHighlightIndex);
    }

    navigateToHighlight(index) {
        // Remove active class from all highlights (element may be null until rendered)
        this.highlights.forEach(h => h.element && h.element.classList.remove('active'));

        const highlight = this.highlights[index];
        if (highlight && highlight.element) {
            highlight.element.classList.add('active');
            highlight.element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            this.currentHighlightIndex = index;
            this.updateNavigationControls();
        }
    }

    updateNavigationControls() {
        if (!this.options.enableNavigation) return;

        const navControls = this.controls.querySelector('.highlighter-nav-controls');
        if (!navControls) return;

        const prevBtn = navControls.querySelector('.nav-prev');
        const nextBtn = navControls.querySelector('.nav-next');
        const counter = navControls.querySelector('.nav-counter');

        const total = this.highlights.length;
        const current = this.currentHighlightIndex + 1;

        // Null-safe: a missing nav element must never abort highlightSelection()
        // before the app callbacks (onHighlightAdd / onChange) fire.
        if (prevBtn) prevBtn.disabled = total === 0;
        if (nextBtn) nextBtn.disabled = total === 0;
        if (counter) counter.textContent = total === 0 ? '0/0' : `${current}/${total}`;
    }

    toggleNumbers() {
        this.options.showNumbers = !this.options.showNumbers;
        const numbers = this.element.querySelectorAll('.highlight-number');
        numbers.forEach(num => {
            num.style.display = this.options.showNumbers ? 'inline' : 'none';
        });
    }

    clearHighlights({ emit = true } = {}) {
        this.highlights = [];
        this.highlightCount = 0;
        this.currentHighlightIndex = -1;
        this.renderHighlights();        // restores the pristine base text
        this.updateNavigationControls();
        // Don't emit when an import is about to repopulate (emit:false) — that would
        // persist a spurious empty set over the app's saved highlights.
        if (emit) this._emitChange();
    }

    toggleNotesPanel() {
        let panel = document.querySelector('.notes-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'notes-panel';
            document.body.appendChild(panel);
        }

        const isVisible = panel.classList.toggle('visible');
        if (isVisible) {
            this.updateNotesPanel();
        }
    }

    updateNotesPanel() {
        const panel = document.querySelector('.notes-panel');
        if (!panel) return;

        panel.innerHTML = `
            <h3>Notes</h3>
            ${this.highlights.map(h => `
                <div class="highlight-note">
                    <div>Highlight #${h.number}: "${h.text}"</div>
                    <textarea
                        placeholder="Add a note..."
                        data-highlight-id="${h.number}"
                    >${h.note || ''}</textarea>
                </div>
            `).join('')}
        `;

        // Add note change handlers
        panel.querySelectorAll('textarea').forEach(textarea => {
            textarea.addEventListener('change', (e) => {
                const highlightId = parseInt(e.target.dataset.highlightId);
                const highlight = this.highlights.find(h => h.number === highlightId);
                if (highlight) {
                    highlight.note = e.target.value;
                    this.saveHighlights();
                }
            });
        });
    }

    navigateSearch(direction) {
        if (this.searchResults.length === 0) return;

        if (direction === 'next') {
            this.searchIndex = (this.searchIndex + 1) % this.searchResults.length;
        } else {
            this.searchIndex = (this.searchIndex - 1 + this.searchResults.length) % this.searchResults.length;
        }

        const highlight = this.searchResults[this.searchIndex];
        if (highlight) {
            const index = this.highlights.indexOf(highlight);
            this.navigateToHighlight(index);
        }

        this.updateSearchCounter();
    }

    updateSearchCounter() {
        const counter = this.controls.querySelector('.search-counter');
        if (!counter) return;

        if (this.searchResults.length === 0) {
            counter.textContent = 'No results';
        } else {
            counter.textContent = `${this.searchIndex + 1}/${this.searchResults.length}`;
        }
    }

    exportHighlights() {
        const data = {
            metadata: this.metadata,
            highlights: this.highlights.map(h => ({
                text: h.text,
                note: h.note,
                number: h.number,
                timestamp: h.timestamp,
                username: h.username,
                metadata: h.metadata
            }))
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `highlights-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importHighlights() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.loadHighlightsFromData(data);
                } catch (error) {
                    console.error('Error importing highlights:', error);
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }

    saveHighlights() {
        if (typeof localStorage !== 'undefined') {
            const data = {
                highlights: this.highlights.map(h => ({
                    text: h.text,
                    note: h.note,
                    number: h.number
                }))
            };
            localStorage.setItem(`highlights-${this.element.id || 'default'}`, JSON.stringify(data));
        }
    }

    loadSavedHighlights() {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem(`highlights-${this.element.id || 'default'}`);
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    this.loadHighlightsFromData(data);
                } catch (error) {
                    console.error('Error loading saved highlights:', error);
                }
            }
        }
    }

    loadHighlightsFromData(data) {
        this.clearHighlights({ emit: false });

        if (data.metadata) {
            this.metadata = { ...this.metadata, ...data.metadata };
        }

        data.highlights.forEach(h => {
            const range = this.findTextInElement(h.text);
            if (range) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                this.highlightSelection();
                
                const lastHighlight = this.highlights[this.highlights.length - 1];
                if (lastHighlight) {
                    lastHighlight.note = h.note;
                    lastHighlight.timestamp = h.timestamp;
                    lastHighlight.username = h.username;
                    lastHighlight.metadata = h.metadata;
                }
            }
        });

        this.updateNavigationControls();
        this.updateNotesPanel();
        this.updateSidebar();
    }

    findTextInElement(text) {
        const walker = document.createTreeWalker(
            this.element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            const index = node.textContent.indexOf(text);
            if (index >= 0) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + text.length);
                return range;
            }
        }

        return null;
    }

    getElementPath(element) {
        const path = [];
        let current = element;
        
        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
                selector += `#${current.id}`;
            } else if (current.className) {
                selector += `.${current.className.split(' ').join('.')}`;
            }
            path.unshift(selector);
            current = current.parentElement;
        }
        
        return path.join(' > ');
    }

    toggleSidebar() {
        let sidebar = document.querySelector('.highlighter-sidebar');
        if (!sidebar) {
            sidebar = document.createElement('div');
            sidebar.className = 'highlighter-sidebar';
            document.body.appendChild(sidebar);
        }

        const isVisible = sidebar.classList.toggle('visible');
        if (isVisible) {
            this.updateSidebar();
        }
    }

    updateSidebar() {
        const sidebar = document.querySelector('.highlighter-sidebar');
        if (!sidebar) return;

        // Group highlights by their superscript number
        const grouped = {};
        this.highlights.forEach(h => {
            if (!grouped[h.number]) grouped[h.number] = [];
            grouped[h.number].push(h);
        });

        // Helper to remove superscript numbers from text (e.g. ¹, ², ³, etc.)
        function stripSuperscripts(text) {
            // Unicode superscripts 1-9: \u00B9, \u00B2, \u00B3, \u2074-\u2079
            return text.replace(/[\u00B9\u00B2\u00B3\u2070-\u2079]/g, '');
        }

        sidebar.innerHTML = `
            <div class="sidebar-header">
                <h3>Highlights</h3>
                <div class="metadata-summary">
                    <small>${this.metadata.title}</small>
                    <br>
                    <small>${new Date().toLocaleDateString()}</small>
                </div>
            </div>
            <div class="sidebar-content">
                ${Object.entries(grouped).map(([number, highlights]) => `
                    <div class="highlight-entry" data-highlight-id="${number}">
                        <div class="highlight-metadata">
                            <span>Highlight #${number}</span> 
 
                            <span>${highlights[0].timestamp ? new Date(highlights[0].timestamp).toLocaleString() : new Date().toLocaleString()}</span> 
 
                            <span>${this.options.username}</span>
                        </div>
                        <ul class="highlight-text-list">
                            ${highlights.map(h => `<li class="highlight-text">"${stripSuperscripts(h.text).trim()}"</li>`).join('')}
                        </ul>
                        ${highlights[0].note ? `
                            <div class="highlight-note-preview">
                                
 ${highlights[0].note}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        // Add click handlers for highlight entries
        sidebar.querySelectorAll('.highlight-entry').forEach(entry => {
            entry.addEventListener('click', () => {
                const highlightId = parseInt(entry.dataset.highlightId);
                // Find the first highlight with this number
                const index = this.highlights.findIndex(h => h.number === highlightId);
                if (index !== -1) {
                    this.navigateToHighlight(index);
                }
            });
        });
    }

    removeHighlightByNumber(number) {
        const index = this.highlights.findIndex(h => h.number === number);
        if (index === -1) return;
        this.highlights.splice(index, 1);
        if (this.currentHighlightIndex >= this.highlights.length) {
            this.currentHighlightIndex = this.highlights.length - 1;
        }
        this.renderHighlights();        // offset model: just re-render from base
        this.updateNavigationControls();
        this.updateSidebar && this.updateSidebar();
        this.updateNotesPanel && this.updateNotesPanel();
        // Notify the app (constitution).
        this.options.onHighlightRemove?.(number);
        this._emitChange();
    }
}