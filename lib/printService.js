export const PrintService = {
    print: (orientation = 'portrait', scale = 1.0) => {
        // Clear any existing orientation classes
        document.body.classList.remove('portrait-mode', 'landscape-mode');
        
        // Add the requested orientation class
        const className = orientation === 'landscape' ? 'landscape-mode' : 'portrait-mode';
        document.body.classList.add(className);
        
        // Apply scaling
        const previousZoom = document.body.style.zoom;
        if (scale !== 1.0) {
            document.body.style.zoom = scale;
        }
        
        // Add a small delay for CSS to apply before opening print dialog
        setTimeout(() => {
            window.print();
            
            // Revert zoom after print dialog opens (print process captures state)
            if (scale !== 1.0) {
                setTimeout(() => {
                    document.body.style.zoom = previousZoom || '';
                }, 1000);
            }
        }, 100);
    }
};
