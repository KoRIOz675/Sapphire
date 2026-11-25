import { useRef } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import GlobalSearch from "./GlobalSearch";
import UpdateNotice from "./UpdateNotice";
import { ShortcutProvider } from "../context/ShortcutContext";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";

function LayoutInner() {
  const searchRef = useRef<HTMLInputElement>(null);
  useGlobalShortcuts(searchRef);

  return (
    <div className="flex h-screen w-screen">
      <Sidebar searchSlot={<GlobalSearch ref={searchRef} />} />
      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="mx-auto max-w-7xl p-6">
          <Outlet />
        </div>
      </main>
      <UpdateNotice />
    </div>
  );
}

export default function Layout() {
  return (
    <ShortcutProvider>
      <LayoutInner />
    </ShortcutProvider>
  );
}
