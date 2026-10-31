"use client";
import * as React from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export function DialogContent({
  children,
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="modal-overlay" />
      <Primitive.Content className="modal" {...props}>
        {children}
        <Primitive.Close className="modal-close" aria-label="Close dialog">
          <X />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
