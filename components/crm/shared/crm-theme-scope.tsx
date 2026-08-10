"use client";

import * as React from "react";

// Adds the `crm-theme` class (styled in app/(crm)/crm-theme.css) to <body>
// for as long as a CRM route is mounted, then removes it. This has to be a
// body-level class rather than a class on the CRM layout's own wrapper div
// because Dialog/Sheet/Select/DropdownMenu content all portal directly onto
// document.body -- a class further down the tree would never reach them.
export function CrmThemeScope() {
  React.useEffect(() => {
    document.body.classList.add("crm-theme");
    return () => {
      document.body.classList.remove("crm-theme");
    };
  }, []);

  return null;
}
