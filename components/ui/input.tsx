import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, onWheel, ...props }: React.ComponentProps<"input">) {
  const handleWheel = React.useCallback(
    (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === "number" || e.currentTarget?.type === "number") {
        e.currentTarget.blur();
      }
      onWheel?.(e);
    },
    [type, onWheel]
  );

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      onWheel={handleWheel}
      className={cn(
        "h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm transition-all outline-none placeholder:text-slate-400 focus-visible:border-[#0F3D3E] focus-visible:ring-3 focus-visible:ring-[#0F3D3E]/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 aria-invalid:border-red-500 aria-invalid:ring-3 aria-invalid:ring-red-200 text-slate-900",
        className
      )}
      {...props}
    />
  );
}

export { Input }
