"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type JqScrollState = {
  scrolled: boolean;
  stickyRails: boolean;
};

const JqScrollContext = createContext<JqScrollState>({
  scrolled: false,
  stickyRails: false,
});

export function useJqScroll() {
  return useContext(JqScrollContext);
}

type ProviderProps = {
  children: ReactNode;
  layoutRef?: React.RefObject<HTMLDivElement | null>;
};

export function JqScrollProvider({ children, layoutRef }: ProviderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [stickyRails, setStickyRails] = useState(false);

  useEffect(() => {
    function update() {
      const doc = document.documentElement;
      const pageScrollable = doc.scrollHeight > window.innerHeight + 48;
      setStickyRails(pageScrollable);
      setScrolled(window.scrollY > 6);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    const el = layoutRef?.current;
    const ro = el ? new ResizeObserver(update) : null;
    if (el && ro) ro.observe(el);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [layoutRef]);

  return (
    <JqScrollContext.Provider value={{ scrolled, stickyRails }}>
      {children}
    </JqScrollContext.Provider>
  );
}
