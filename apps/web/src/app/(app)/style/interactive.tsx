"use client";

import { Button } from "@virasat/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@virasat/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@virasat/ui/menu";
import { Sheet, SheetContent, SheetTrigger } from "@virasat/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@virasat/ui/tabs";
import { toast } from "@virasat/ui/toaster";
import { buttonClass } from "@virasat/ui/button";
import { MoreHorizontal } from "lucide-react";

// Design review only: the interactive pieces of @virasat/ui, in one place.
export function StyleInteractive() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <Sheet>
          <SheetTrigger className={buttonClass("secondary")}>Open sheet</SheetTrigger>
          <SheetContent title="I cooked it" description="Add a photo and a note for your family.">
            <p className="text-muted">Bottom sheets keep quick tasks on the same screen.</p>
          </SheetContent>
        </Sheet>

        <Dialog>
          <DialogTrigger className={buttonClass("secondary")}>Open dialog</DialogTrigger>
          <DialogContent
            title="Remove this recording?"
            description="The text recipe stays. The audio is deleted for good."
            closeLabel="Close"
          >
            <Button kind="danger">Remove recording</Button>
          </DialogContent>
        </Dialog>

        <Menu>
          <MenuTrigger className={buttonClass("secondary")} aria-label="More actions">
            <MoreHorizontal aria-hidden className="size-5" />
          </MenuTrigger>
          <MenuContent>
            <MenuItem>Rename</MenuItem>
            <MenuItem>Share</MenuItem>
          </MenuContent>
        </Menu>

        <Button kind="secondary" onClick={() => toast("Link copied")}>
          Show toast
        </Button>
      </div>

      <Tabs defaultValue="voice">
        <TabsList>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
        </TabsList>
        <TabsContent value="voice" className="text-muted">
          Record someone telling the recipe.
        </TabsContent>
        <TabsContent value="pages" className="text-muted">
          Photograph a handwritten page.
        </TabsContent>
      </Tabs>
    </div>
  );
}
