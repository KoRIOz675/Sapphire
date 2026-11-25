import { useEffect, useRef } from "react";
import { useShortcutContext } from "../context/ShortcutContext";

/**
 * Global keyboard shortcuts — mount once inside Layout.
 *
 * Ctrl+K  → focus the global search input
 * Ctrl+N  → open "create new" modal for the current page
 * Escape  → close any open modal (dispatches custom event)
 */
export function useGlobalShortcuts(searchInputRef: React.RefObject<HTMLInputElement | null>) {
  const { triggerCreate } = useShortcutContext();
  // Keep triggerCreate stable in the closure
  const triggerRef = useRef(triggerCreate);
  triggerRef.current = triggerCreate;

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      // Ctrl+K / Cmd+K — focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Ctrl+N / Cmd+N — create new entity (only when not in an input)
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        if (!inInput) {
          e.preventDefault();
          triggerRef.current();
        }
        return;
      }

      // Escape — close modal/dropdown
      if (e.key === "Escape") {
        document.dispatchEvent(new CustomEvent("sapphire:close-modal"));
        return;
      }
    }

    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [searchInputRef]);
}
