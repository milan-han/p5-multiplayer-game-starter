// =================================================================================
// DPI UTILITY FUNCTIONS - Centralized DPI handling for consistency
// =================================================================================

export class DPR {
    constructor(canvas = null) {
        this.canvas = canvas;
    }
    
    // Set canvas reference (useful if created after DPR initialization)
    setCanvas(canvas) {
        this.canvas = canvas;
    }
    
    // Get current device pixel ratio
    get() {
        return window.devicePixelRatio || 1;
    }
    
    // Convert CSS pixels to canvas buffer pixels
    cssToCanvas(cssPixels) {
        return cssPixels * this.get();
    }
    
    // Convert canvas buffer pixels to CSS pixels
    canvasToCSS(canvasPixels) {
        return canvasPixels / this.get();
    }
    
    // Get logical canvas dimensions (CSS pixels)
    logicalWidth() {
        return this.canvas ? this.canvas.width / this.get() : 0;
    }
    
    logicalHeight() {
        return this.canvas ? this.canvas.height / this.get() : 0;
    }
    
    // Get logical canvas center (CSS pixels)
    logicalCenter() {
        return {
            x: this.logicalWidth() / 2,
            y: this.logicalHeight() / 2
        };
    }
    
    // Get logical canvas bounds (CSS pixels)
    logicalBounds() {
        return {
            width: this.logicalWidth(),
            height: this.logicalHeight(),
            centerX: this.logicalWidth() / 2,
            centerY: this.logicalHeight() / 2
        };
    }
    
    // Setup canvas with proper DPR scaling
    setupCanvas(canvas, ctx) {
        const dpr = this.get();
        
        // Set canvas CSS size
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        
        // Set actual pixel buffer to match DPR
        canvas.width = Math.floor(this.cssToCanvas(window.innerWidth));
        canvas.height = Math.floor(this.cssToCanvas(window.innerHeight));
        
        // Reset any prior transforms then apply DPR scaling so 1 unit == 1 CSS pixel
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        
        // Update canvas reference
        this.setCanvas(canvas);
        
        return { width: canvas.width, height: canvas.height };
    }
}

// Create and export singleton instance
export const dpr = new DPR();