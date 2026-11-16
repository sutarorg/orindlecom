"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--brand-ease-out)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white shadow-[var(--brand-shadow-primary)] hover:bg-primary-hover hover:-translate-y-px active:translate-y-0 active:bg-[var(--brand-primary-active)]",
        secondary:
          "bg-white text-ink border border-[var(--brand-border-strong)] shadow-xs hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-surface-muted)] active:bg-[var(--brand-surface-muted)]",
        outline:
          "bg-transparent text-ink border border-[var(--brand-border-strong)] hover:bg-[var(--brand-surface-muted)]",
        ghost: "bg-transparent text-ink hover:bg-[var(--brand-surface-muted)]",
        quiet: "bg-primary-soft text-primary-ink hover:bg-primary-soft-2",
        link: "bg-transparent text-primary underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-9 px-4 text-[13px] tracking-[-0.004em] rounded-[10px]",
        md: "h-11 px-5 text-[14px] tracking-[-0.005em] rounded-xl",
        lg: "h-12 px-6 text-[15px] tracking-[-0.006em] rounded-full",
        xl: "h-[52px] px-7 text-[15px] tracking-[-0.006em] rounded-full",
        icon: "h-10 w-10 rounded-xl",
      },
      pill: { true: "rounded-full", false: "" },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", pill: false, full: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, pill, full, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, pill, full }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
