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

    generateStyles() {
        return `
            .highlight-wrapper {
                position: relative;
                display: inline;
                white-space: pre-wrap;
                vertical-align: baseline;
            }

            .highlight-content {
                background-color: var(--highlight-color, ${this.options.highlightColor});
                box-decoration-break: clone;
                -webkit-box-decoration-break: clone;
                border-radius: 0.1em;
                padding: 0;
                margin: 0;
            }

            .highlight-number {
                position: absolute;
                top: -0.7em;
                right: -0.5em;
                font-size: 0.7em;
                font-weight: bold;
                color: var(--superscript-color, ${this.options.superscriptColor});
                background-color: white;
                border-radius: 1em;
                padding: 0.1em 0.3em;
                line-height: normal;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                user-select: none;
                cursor: pointer;
                display: ${this.options.showNumbers ? 'block' : 'none'};
                z-index: 1;
            }

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
            this.hideHighlights();
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
        this.highlights.forEach(h => {
            h.element.style.display = '';
        });
    }

    hideHighlights() {
        this.highlights.forEach(h => {
            h.element.style.display = 'none';
        });
    }

    highlightSelection() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (!this.element.contains(range.commonAncestorContainer)) return;

        try {
            this.highlightCount++;
            const highlightNumber = this.highlightCount;

            // Helper to wrap a node in highlight markup
            const wrapNode = (node) => {
                const wrapper = document.createElement('span');
                wrapper.className = 'highlight-wrapper';
                wrapper.setAttribute('data-highlight-id', highlightNumber);
                const content = document.createElement('span');
                content.className = 'highlight-content';
                content.appendChild(node);
                const superscript = document.createElement('span');
                superscript.textContent = highlightNumber;
                superscript.className = 'highlight-number';
                wrapper.appendChild(content);
                wrapper.appendChild(superscript);
                // Add click handlers
                wrapper.addEventListener('click', () => this.handleHighlightClick(highlightNumber));
                superscript.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleHighlightClick(highlightNumber);
                });
                superscript.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this.removeHighlightByNumber(highlightNumber);
                });
                if (this.options.enableNotes) {
                    wrapper.setAttribute('data-note', '');
                }
                return wrapper;
            };

            // Helper to recursively highlight text nodes in a fragment
            const highlightFragment = (fragment) => {
                const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, null, false);
                let textNodes = [];
                let node;
                while ((node = walker.nextNode())) {
                    if (node.textContent.trim().length > 0) {
                        textNodes.push(node);
                    }
                }
                // Wrap each text node
                textNodes.forEach(textNode => {
                    const highlightSpan = wrapNode(textNode.cloneNode(true));
                    textNode.parentNode.replaceChild(highlightSpan, textNode);
                });
            };

            // Extract the contents of the range
            const fragment = range.extractContents();
            highlightFragment(fragment);
            range.insertNode(fragment);

            // Collect all new highlight wrappers for navigation, sidebar, etc.
            const newHighlights = Array.from(this.element.querySelectorAll('.highlight-wrapper[data-highlight-id="' + highlightNumber + '"]'));
            newHighlights.forEach(wrapper => {
                this.highlights.push({
                    element: wrapper,
                    text: wrapper.innerText,
                    number: highlightNumber,
                    timestamp: new Date().toISOString(),
                    username: this.options.username,
                    metadata: { ...this.metadata }
                });
                // Hide highlight if not in highlight mode
                if (!this._highlightMode) wrapper.style.display = 'none';
            });

            this.updateNavigationControls();
            this.updateSidebar();
            selection.removeAllRanges();
            // Show toolbar when a highlight is made
            if (this._highlightMode) this.showToolbar(true);
        } catch (error) {
            console.warn('Could not highlight selection:', error);
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
        if (index !== -1) {
            this.navigateToHighlight(index);
        }
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
        // Remove active class from all highlights
        this.highlights.forEach(h => h.element.classList.remove('active'));

        const highlight = this.highlights[index];
        if (highlight) {
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

        prevBtn.disabled = total === 0;
        nextBtn.disabled = total === 0;
        counter.textContent = total === 0 ? '0/0' : `${current}/${total}`;
    }

    toggleNumbers() {
        this.options.showNumbers = !this.options.showNumbers;
        const numbers = this.element.querySelectorAll('.highlight-number');
        numbers.forEach(num => {
            num.style.display = this.options.showNumbers ? 'block' : 'none';
        });
    }

    clearHighlights() {
        // Only remove from DOM if called directly (not on deactivate)
        this.highlights.forEach(({ element }) => {
            if (element.parentNode) {
                const text = element.textContent || '';
                element.parentNode.replaceChild(
                    document.createTextNode(text),
                    element
                );
            }
        });
        this.highlights = [];
        this.highlightCount = 0;
        this.currentHighlightIndex = -1;
        this.updateNavigationControls();
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
        this.clearHighlights();
        
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

        // Helper to remove superscript numbers from text (e.g., 
, etc.)
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
        if (index !== -1) {
            const { element } = this.highlights[index];
            if (element.parentNode) {
                // Only restore the original highlighted text, not the superscript
                const content = element.querySelector('.highlight-content');
                const text = content ? content.textContent : element.textContent || '';
                element.parentNode.replaceChild(
                    document.createTextNode(text),
                    element
                );
            }
            this.highlights.splice(index, 1);
            // Adjust highlightCount and currentHighlightIndex if needed
            if (this.currentHighlightIndex >= this.highlights.length) {
                this.currentHighlightIndex = this.highlights.length - 1;
            }
            this.updateNavigationControls();
            this.updateSidebar && this.updateSidebar();
            this.updateNotesPanel && this.updateNotesPanel();
        }
    }