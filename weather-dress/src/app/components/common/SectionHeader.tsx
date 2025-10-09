export function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
