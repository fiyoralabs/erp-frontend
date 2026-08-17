"use client";

import React, { useEffect } from "react";

/**
 * Global component that prevents mouse wheel scrolling from accidentally changing
 * numeric input values (<input type="number">) across the entire ERP application,
 * while allowing normal page/container scrolling to proceed smoothly.
 */
export function GlobalNumberInputScrollFix() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        activeEl.tagName === "INPUT" &&
        (activeEl as HTMLInputElement).type === "number"
      ) {
        // Blurring the active number input when a wheel event occurs stops the
        // browser's native wheel-value-increment behavior without blocking native
        // vertical page or container scrolling.
        activeEl.blur();
      }
    };

    // Use passive capture listener for maximum scroll performance across all browsers
    window.addEventListener("wheel", handleWheel, { passive: true, capture: true });

    return () => {
      window.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, []);

  return null;
}
