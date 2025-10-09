export function PlaceholderCard({ text }: { text: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-sm text-neutral-500">
        {text}
      </div>
      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-sm text-neutral-500">
        Wire in charts/lists.
      </div>
      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-sm text-neutral-500">
        Add skeleton states.
      </div>
    </div>
  );
}
