import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * LoadingButton — pola dari dashboard starter (components/ui/loading-button.tsx).
 * Menampilkan spinner + menonaktifkan tombol saat proses berjalan.
 */
export function LoadingButton({ loading = false, disabled, children, loadingText, ...props }) {
  return (
    <Button disabled={loading || disabled} aria-busy={loading || undefined} {...props}>
      {loading && <Spinner />}
      {loading && loadingText ? loadingText : children}
    </Button>
  );
}

export default LoadingButton;
