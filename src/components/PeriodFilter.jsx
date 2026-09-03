import { useEffect, useState } from "react";
import { ID_MONTHS, todayStr } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// onChange receives { start, end, label }
export default function PeriodFilter({ onChange }) {
  const year = new Date().getFullYear();
  const [mode, setMode] = useState("full");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [start, setStart] = useState(`${year}-01-01`);
  const [end, setEnd] = useState(todayStr());

  const emit = (m, mo, s, e) => {
    let res = { start: "", end: "", label: "" };
    if (m === "full") {
      res = { start: `${year}-01-01`, end: todayStr(), label: `Tahun ${year} (Jan–${ID_MONTHS[new Date().getMonth()]})` };
    } else if (m === "month") {
      const mm = Number(mo);
      const lastDay = new Date(year, mm, 0).getDate();
      const pad = (x) => String(x).padStart(2, "0");
      res = { start: `${year}-${pad(mm)}-01`, end: `${year}-${pad(mm)}-${pad(lastDay)}`, label: `${ID_MONTHS[mm - 1]} ${year}` };
    } else {
      res = { start: s, end: e, label: "Rentang Custom" };
    }
    onChange && onChange(res);
  };

  useEffect(() => { emit(mode, month, start, end); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Periode</Label>
        <Select
          value={mode}
          onValueChange={(v) => { setMode(v); emit(v, month, start, end); }}
        >
          <SelectTrigger className="w-[180px]" data-testid="period-mode-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Tahun Berjalan Penuh</SelectItem>
            <SelectItem value="month">Per Bulan</SelectItem>
            <SelectItem value="custom">Rentang Tanggal Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "month" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Bulan</Label>
          <Select value={month} onValueChange={(v) => { setMonth(v); emit("month", v, start, end); }}>
            <SelectTrigger className="w-[150px]" data-testid="period-month-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ID_MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {mode === "custom" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Dari</Label>
            <Input type="date" value={start} min={`${year}-01-01`} max={`${year}-12-31`}
              data-testid="period-start-input"
              onChange={(e) => { setStart(e.target.value); emit("custom", month, e.target.value, end); }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sampai</Label>
            <Input type="date" value={end} min={`${year}-01-01`} max={`${year}-12-31`}
              data-testid="period-end-input"
              onChange={(e) => { setEnd(e.target.value); emit("custom", month, start, e.target.value); }} />
          </div>
        </>
      )}
    </div>
  );
}
