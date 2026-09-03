import { Check, Loader2 } from "lucide-react";
import { useLang } from "@/context/LangContext";

/**
 * Stepper produksi PO.
 *
 * Struktur & ukuran dipertahankan (tombol p-3, indikator 36px, gap-2) supaya
 * posisi tiap tahap di layar tidak berubah. Polish mengikuti pola "Steps"
 * 21st.dev: garis penghubung antar indikator (digambar absolute sehingga tidak
 * mempengaruhi layout), ring pada tahap aktif, dan transisi transform 200ms.
 */

const COLORS = {
  done: "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/30",
  processing: "bg-blue-500 text-white border-blue-600 ring-4 ring-blue-500/20",
  waiting: "bg-amber-500 text-amber-950 border-amber-600",
  muted: "bg-secondary text-muted-foreground border-border",
};

const LINE = {
  done: "bg-emerald-500/60",
  processing: "bg-blue-500/40",
  waiting: "bg-border",
  muted: "bg-border",
};

export default function ProductionStepper({ po, onSelect, activeStage }) {
  const { stageName } = useLang();
  const enabled = (po.enabled_stages || []).slice().sort((a, b) => a - b);
  const cur = po.computed?.current_stage;
  const completed = po.computed?.is_completed;

  const statusFor = (num) => {
    if (completed) return "done";
    if (cur === 0) return "done";
    if (num < cur) return "done";
    if (num === cur) return "processing";
    return "waiting";
  };

  return (
    <div className="flex flex-col gap-2" data-testid="production-stepper">
      {enabled.map((num, idx) => {
        const st = statusFor(num);
        const isActive = activeStage === num;
        const isLast = idx === enabled.length - 1;
        return (
          <button
            key={num}
            onClick={() => onSelect && onSelect(num)}
            data-testid={`stepper-stage-${num}`}
            aria-current={isActive ? "step" : undefined}
            className={`group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out ${
              isActive
                ? "border-primary bg-accent shadow-soft"
                : "border-border hover:border-primary/30 hover:bg-accent/50"
            }`}
          >
            {/* Garis penghubung antar tahap (absolute -> tidak mengubah layout) */}
            {!isLast && (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-[29px] top-[54px] h-[18px] w-[2px] rounded-full transition-colors duration-200 ${LINE[st]}`}
              />
            )}
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-transform duration-200 ease-out group-hover:scale-105 ${COLORS[st]}`}
            >
              {st === "done" ? (
                <Check className="h-4 w-4" />
              ) : st === "processing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="font-mono tabular-nums">{num}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Tahap {num}</div>
              <div className="truncate text-sm font-medium">{stageName(num)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
