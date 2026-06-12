"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { JqScrollProvider, useJqScroll } from "../jq-scroll-context";

function JqLayoutInner({
  layoutRef,
  isHomeFeed,
  children,
  className,
}: {
  layoutRef: React.RefObject<HTMLDivElement | null>;
  isHomeFeed: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { stickyRails } = useJqScroll();

  return (
    <div
      ref={layoutRef}
      className={cn("jq-layout", isHomeFeed && "jq-layout--home", className)}
      data-sticky-rails={stickyRails ? "true" : undefined}
    >
      {children}
    </div>
  );
}

type Props = {
  children: ReactNode;
  isHomeFeed: boolean;
  className?: string;
};

export function JqLayoutFrame({ children, isHomeFeed, className }: Props) {
  const layoutRef = useRef<HTMLDivElement>(null);

  return (
    <JqScrollProvider layoutRef={layoutRef}>
      <JqLayoutInner layoutRef={layoutRef} isHomeFeed={isHomeFeed} className={className}>
        {children}
      </JqLayoutInner>
    </JqScrollProvider>
  );
}
