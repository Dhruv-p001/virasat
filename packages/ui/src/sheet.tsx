"use client";

import type { ComponentProps, ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "./cn.ts";

// A bottom sheet for quick tasks (Add, I cooked it). Vaul gives drag-to-dismiss and focus
// handling; the title is required so the sheet always has an accessible name.

export const Sheet = Drawer.Root;
export const SheetTrigger = Drawer.Trigger;
export const SheetClose = Drawer.Close;

export function SheetContent({
  title,
  description,
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof Drawer.Content>, "title"> & {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Portal>
      <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
      <Drawer.Content
        {...props}
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-lg bg-paper px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lift outline-none",
          className,
        )}
      >
        <Drawer.Handle className="my-3 !h-1.5 !w-12 !bg-outline" />
        <Drawer.Title className="font-serif text-xl font-semibold">{title}</Drawer.Title>
        {description && (
          <Drawer.Description className="mt-1 text-muted">{description}</Drawer.Description>
        )}
        <div className="mt-4 flex flex-col gap-3 overflow-y-auto">{children}</div>
      </Drawer.Content>
    </Drawer.Portal>
  );
}
