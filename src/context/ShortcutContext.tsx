import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { useLocation } from "react-router-dom";

type Handler = () => void;

interface ShortcutContextValue {
  registerCreate: (route: string, handler: Handler) => void;
  unregisterCreate: (route: string) => void;
  triggerCreate: () => void;
}

const ShortcutContext = createContext<ShortcutContextValue>({
  registerCreate: () => {},
  unregisterCreate: () => {},
  triggerCreate: () => {},
});

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const handlers = useRef<Map<string, Handler>>(new Map());

  function registerCreate(route: string, handler: Handler) {
    handlers.current.set(route, handler);
  }

  function unregisterCreate(route: string) {
    handlers.current.delete(route);
  }

  function triggerCreate() {
    // Find the handler whose route matches the current pathname
    const path = window.location.pathname;
    for (const [route, handler] of handlers.current) {
      if (path.startsWith(route)) {
        handler();
        return;
      }
    }
  }

  return (
    <ShortcutContext.Provider value={{ registerCreate, unregisterCreate, triggerCreate }}>
      {children}
    </ShortcutContext.Provider>
  );
}

/** Register a "create new" handler for the current page. Cleans up on unmount. */
export function useRegisterCreateHandler(handler: Handler) {
  const { registerCreate, unregisterCreate } = useContext(ShortcutContext);
  const location = useLocation();
  // Use the first two path segments as key (e.g. "/people", "/actions")
  const route = "/" + location.pathname.split("/").filter(Boolean)[0];

  useEffect(() => {
    registerCreate(route, handler);
    return () => unregisterCreate(route);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);
}

export function useShortcutContext() {
  return useContext(ShortcutContext);
}
