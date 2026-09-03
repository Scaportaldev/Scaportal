export const LOGO_URL =
  "https://customer-assets-gfyr7b9c.emergentagent.net/job_mutasi-stok/artifacts/k6zao2lr_Screenshot_488.png";

export default function Logo({ size = 40, className = "" }) {
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-md bg-white p-1 shadow-sm ${className}`}
      style={{ height: size, width: size }}
    >
      <img src={LOGO_URL} alt="Logo SCA" className="h-full w-full object-contain" />
    </div>
  );
}
