import React, { useRef, useEffect } from 'react';
import { HighlighterDecorator, HighlightableOptions } from '../src/HighlighterDecorator';

interface HighlightableProps extends HighlightableOptions {
    children: React.ReactNode;
    className?: string;
}

// React component that uses the highlighter
export const Highlightable: React.FC<HighlightableProps> = ({
    children,
    className = '',
    ...options
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (containerRef.current) {
            new HighlighterDecorator(containerRef.current, options);
        }
    }, []);

    return (
        <div ref={containerRef} className={className}>
            {children}
        </div>
    );
};

// Usage Example
export const ArticleWithHighlights: React.FC = () => {
    return (
        <div className="article">
            <h1>Article Title</h1>
            
            <Highlightable
                pinColor="#3b82f6"
                highlightColor="rgba(59, 130, 246, 0.2)"
                pinPosition="bottom-right"
            >
                <p>
                    This paragraph can be highlighted. The pin will appear in the
                    bottom-right corner with a blue theme.
                </p>
            </Highlightable>

            <p>This paragraph cannot be highlighted (no decorator).</p>

            <Highlightable
                pinColor="#10b981"
                highlightColor="rgba(16, 185, 129, 0.2)"
                pinPosition="top-right"
            >
                <div className="important-section">
                    <h2>Important Section</h2>
                    <p>
                        This entire section can be highlighted. The pin appears in
                        the top-right corner with a green theme.
                    </p>
                    <ul>
                        <li>List items can be highlighted too</li>
                        <li>Each item or multiple items at once</li>
                    </ul>
                </div>
            </Highlightable>
        </div>
    );
}; 