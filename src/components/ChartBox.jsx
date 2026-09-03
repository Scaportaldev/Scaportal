import { useEffect, useRef, useState } from "react";

/**
 * Wadah chart yang menunda render isinya sampai ukuran container terukur > 0.
 *
 * Recharts <ResponsiveContainer> memunculkan warning
 * "The width(-1) and height(-1) of chart should be greater than 0"
 * bila di-mount saat container masih 0px (mis. di dalam tab yang belum aktif
 * atau saat layout belum selesai). Komponen ini mencegah hal itu.
 */
export default function ChartBox({ className = "h-64", children, ...rest }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setReady(true);
    };
    check();
    if (typeof ResizeObserver === "undefined") {
      setReady(true);
      return;
    }
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} {...rest}>
      {ready ? children : null}
    </div>
  );
}
