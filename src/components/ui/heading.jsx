/**
 * Heading — pola dari dashboard starter (components/ui/heading.tsx).
 * Judul + deskripsi halaman dengan tipografi konsisten.
 */
export function Heading({ title, description, className = "" }) {
  return (
    <div className={className}>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export default Heading;
