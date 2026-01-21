"use client";

import { useState, useEffect } from "react";

/**
 * Hook to detect and react to dark mode changes.
 * Monitors the document's 'dark' class on the html element.
 * 
 * @returns boolean indicating if dark mode is active
 */
export function useDarkMode(): boolean {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const check = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    
    // Initial check
    check();
    
    // Watch for class changes on html element
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ["class"] 
    });
    
    return () => observer.disconnect();
  }, []);

  return isDarkMode;
}

export default useDarkMode;
