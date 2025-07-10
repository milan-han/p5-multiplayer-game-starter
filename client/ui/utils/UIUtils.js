// =================================================================================
// UI UTILITIES - Blueprint Battle UI System
// =================================================================================
// Utility functions for spatial calculations, bounds checking, and common operations
// Extracted from the monolithic UIComponents class

export class UIUtils {
    constructor() {
        // Static utility class - no instance state needed
    }
    
    // =============================================================================
    // BOUNDS AND SPATIAL CALCULATIONS
    // =============================================================================
    
    /**
     * Get canvas bounds
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @returns {Object} Bounds object {x, y, width, height}
     */
    static getBounds(canvas) {
        return {
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height
        };
    }
    
    /**
     * Get logical center of canvas
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @returns {Object} Center coordinates {x, y}
     */
    static getCenter(canvas) {
        return {
            x: canvas.width / 2,
            y: canvas.height / 2
        };
    }
    
    /**
     * Check if point is within bounds
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} bounds - Bounds object {x, y, width, height}
     * @returns {boolean} True if point is within bounds
     */
    static isPointInBounds(x, y, bounds) {
        return x >= bounds.x && 
               x <= bounds.x + bounds.width && 
               y >= bounds.y && 
               y <= bounds.y + bounds.height;
    }
    
    /**
     * Create a bounds object
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @returns {Object} Bounds object
     */
    static createBounds(x, y, width, height) {
        return { x, y, width, height };
    }
    
    /**
     * Check if two bounds intersect
     * @param {Object} bounds1 - First bounds object
     * @param {Object} bounds2 - Second bounds object
     * @returns {boolean} True if bounds intersect
     */
    static boundsIntersect(bounds1, bounds2) {
        return !(bounds1.x + bounds1.width < bounds2.x ||
                bounds2.x + bounds2.width < bounds1.x ||
                bounds1.y + bounds1.height < bounds2.y ||
                bounds2.y + bounds2.height < bounds1.y);
    }
    
    /**
     * Expand bounds by margin
     * @param {Object} bounds - Original bounds
     * @param {number} margin - Margin to add on all sides
     * @returns {Object} Expanded bounds
     */
    static expandBounds(bounds, margin) {
        return {
            x: bounds.x - margin,
            y: bounds.y - margin,
            width: bounds.width + margin * 2,
            height: bounds.height + margin * 2
        };
    }
    
    // =============================================================================
    // TEXT MEASUREMENT AND UTILITIES
    // =============================================================================
    
    /**
     * Measure text dimensions
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} text - Text to measure
     * @param {Object} style - Text style options
     * @returns {Object} Text metrics {width, height}
     */
    static measureText(ctx, text, style = {}) {
        ctx.save();
        
        // Apply font style
        if (style.font || style.size) {
            const font = UIUtils.buildFontString(style);
            ctx.font = font;
        }
        
        const metrics = ctx.measureText(text);
        
        // Estimate height (canvas doesn't provide reliable height measurement)
        const fontSize = UIUtils.extractFontSize(ctx.font);
        const height = fontSize * 1.2; // Approximate line height
        
        ctx.restore();
        
        return {
            width: metrics.width,
            height: height,
            actualBoundingBoxLeft: metrics.actualBoundingBoxLeft || 0,
            actualBoundingBoxRight: metrics.actualBoundingBoxRight || metrics.width,
            actualBoundingBoxAscent: metrics.actualBoundingBoxAscent || fontSize * 0.8,
            actualBoundingBoxDescent: metrics.actualBoundingBoxDescent || fontSize * 0.2
        };
    }
    
    /**
     * Build font string from style object
     * @param {Object} style - Style object with font properties
     * @returns {string} CSS font string
     */
    static buildFontString(style) {
        const weight = style.weight || style.fontWeight || 'normal';
        const size = style.size || style.fontSize || '16px';
        const family = style.font || style.fontFamily || 'Inter';
        
        return `${weight} ${size}px ${family}`;
    }
    
    /**
     * Extract font size from font string
     * @param {string} fontString - CSS font string
     * @returns {number} Font size in pixels
     */
    static extractFontSize(fontString) {
        const match = fontString.match(/(\d+)px/);
        return match ? parseInt(match[1]) : 16;
    }
    
    // =============================================================================
    // COLOR AND STYLING UTILITIES
    // =============================================================================
    
    /**
     * Parse RGBA color string
     * @param {string} color - Color string (hex, rgb, rgba)
     * @returns {Object} Color object {r, g, b, a}
     */
    static parseColor(color) {
        // Handle hex colors
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return { r, g, b, a: 1 };
        }
        
        // Handle rgb/rgba colors
        const match = color.match(/rgba?\(([^)]+)\)/);
        if (match) {
            const parts = match[1].split(',').map(p => parseFloat(p.trim()));
            return {
                r: parts[0] || 0,
                g: parts[1] || 0,
                b: parts[2] || 0,
                a: parts[3] !== undefined ? parts[3] : 1
            };
        }
        
        // Default to black
        return { r: 0, g: 0, b: 0, a: 1 };
    }
    
    /**
     * Create RGBA color string
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @param {number} a - Alpha (0-1)
     * @returns {string} RGBA color string
     */
    static rgba(r, g, b, a = 1) {
        return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
    }
    
    /**
     * Adjust color alpha
     * @param {string} color - Original color
     * @param {number} alpha - New alpha value (0-1)
     * @returns {string} Color with adjusted alpha
     */
    static withAlpha(color, alpha) {
        const parsed = UIUtils.parseColor(color);
        return UIUtils.rgba(parsed.r, parsed.g, parsed.b, alpha);
    }
    
    /**
     * Blend two colors
     * @param {string} color1 - First color
     * @param {string} color2 - Second color
     * @param {number} ratio - Blend ratio (0 = color1, 1 = color2)
     * @returns {string} Blended color
     */
    static blendColors(color1, color2, ratio) {
        const c1 = UIUtils.parseColor(color1);
        const c2 = UIUtils.parseColor(color2);
        
        const r = c1.r + (c2.r - c1.r) * ratio;
        const g = c1.g + (c2.g - c1.g) * ratio;
        const b = c1.b + (c2.b - c1.b) * ratio;
        const a = c1.a + (c2.a - c1.a) * ratio;
        
        return UIUtils.rgba(r, g, b, a);
    }
    
    // =============================================================================
    // ANIMATION AND EASING UTILITIES
    // =============================================================================
    
    /**
     * Linear interpolation
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    static lerp(start, end, t) {
        return start + (end - start) * t;
    }
    
    /**
     * Clamp value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    
    /**
     * Ease out cubic function
     * @param {number} t - Time parameter (0-1)
     * @returns {number} Eased value
     */
    static easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    /**
     * Ease in out quad function
     * @param {number} t - Time parameter (0-1)
     * @returns {number} Eased value
     */
    static easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    
    /**
     * Get pulse value for animations
     * @param {number} time - Current time
     * @param {number} speed - Pulse speed
     * @returns {number} Pulse value (0-1)
     */
    static getPulse(time, speed = 0.005) {
        return (Math.sin(time * speed) + 1) * 0.5;
    }
    
    // =============================================================================
    // CANVAS DRAWING UTILITIES
    // =============================================================================
    
    /**
     * Draw rounded rectangle
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius
     */
    static drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    /**
     * Draw line with dash pattern
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {Array} dashPattern - Dash pattern array
     */
    static drawDashedLine(ctx, x1, y1, x2, y2, dashPattern) {
        ctx.save();
        ctx.setLineDash(dashPattern);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }
    
    // =============================================================================
    // DEBUGGING UTILITIES
    // =============================================================================
    
    /**
     * Draw debug bounds
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} bounds - Bounds to draw
     * @param {string} color - Debug color
     */
    static drawDebugBounds(ctx, bounds, color = 'red') {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.restore();
    }
    
    /**
     * Log performance timing
     * @param {string} label - Performance label
     * @param {Function} fn - Function to time
     * @returns {*} Function result
     */
    static timeFunction(label, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`${label}: ${(end - start).toFixed(2)}ms`);
        return result;
    }
}