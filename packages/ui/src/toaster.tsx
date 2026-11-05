"use client";

import { Toaster as Sonner, toast } from "sonner";

export { toast };

/** Mount once in the app shell. Toasts sit above the bottom navigation on phones. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      mobileOffset={{ bottom: "6rem" }}
      offset={{ bottom: "2rem" }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-md bg-ink px-4 py-3 text-paper shadow-lift sm:w-96",
          title: "font-medium",
          description: "text-sm opacity-80",
        },
      }}
    />
  );
}
