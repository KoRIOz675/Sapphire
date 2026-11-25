import clsx from "clsx";
import { ReactNode } from "react";

type Tone = "slate" | "blue" | "green" | "amber" | "red" | "violet";

export default function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const map: Record<Tone, string> = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return <span className={clsx("badge", map[tone])}>{children}</span>;
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "to do":
      return "amber";
    case "in progress":
      return "blue";
    case "done":
      return "green";
    default:
      return "slate";
  }
}
