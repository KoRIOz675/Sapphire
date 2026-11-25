import { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-base font-medium text-slate-700">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-slate-500">{description}</p>
      )}
      {action}
    </div>
  );
}
