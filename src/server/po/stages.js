// Server-side PO status computation (mirror STAGE_NAMES di frontend).
export const STAGE_NAMES = {
  1: "Menunggu PO Kertas / Single Face",
  2: "Menunggu Pesanan CTCP",
  3: "Menunggu Pesanan Pisau Plong",
  4: "Proses Potong Kertas",
  5: "Proses Cetak",
  6: "Proses Finishing",
  7: "Proses Plong",
  8: "Proses Kopek",
  9: "Proses Lem",
  10: "Proses Packing",
  11: "Selesai Cetak & Pengiriman",
};

export function lastAttempt(data) {
  const arr = data?.delivery_attempts || [];
  return arr.length ? arr[arr.length - 1] : null;
}

export function isStageDone(po, num) {
  const data = (po.stage_data || {})[String(num)] || {};
  if (num === 1) {
    if (data.needs_single_face) return !!(data.paper_arrived && data.single_face_arrived);
    return !!data.paper_arrived;
  }
  if (num === 2 || num === 3) return !!data.arrived;
  if (num === 11) {
    const att = lastAttempt(data);
    return !!data.print_completed && !!att && att.status === "success";
  }
  return !!data.done;
}

export function computeStatus(po) {
  const enabled = [...(po.enabled_stages || [])].sort((a, b) => a - b);
  let current = null;
  for (const n of enabled) {
    if (!isStageDone(po, n)) { current = n; break; }
  }
  const completed = current === null && enabled.length > 0;
  const data11 = (po.stage_data || {})["11"] || {};
  const att = lastAttempt(data11);
  const printCompleted = !!data11.print_completed;

  let bucket = "unknown";
  if (!enabled.length) bucket = "no_stages";
  else if (completed) bucket = "completed";
  else if ([1, 2, 3].includes(current)) bucket = `waiting_${current}`;
  else if ([4, 5, 6, 7, 8, 9, 10].includes(current)) bucket = `stage_${current}`;
  else if (current === 11) {
    if (!printCompleted) bucket = "printing";
    else if (att && att.status === "failed") bucket = "delivery_failed";
    else bucket = "print_done_not_shipped";
  }

  let deliveryStatus = null;
  if (enabled.includes(11)) {
    if (att) deliveryStatus = att.status;
    else if (printCompleted) deliveryStatus = "no_schedule";
  }

  return {
    current_stage: current || 0,
    current_stage_name: STAGE_NAMES[current] || "Selesai",
    bucket,
    print_completed: printCompleted,
    delivery_status: deliveryStatus,
    is_completed: completed,
  };
}

export function enrichPo(po) {
  if (!po) return po;
  const { _id, ...rest } = po;
  rest.computed = computeStatus(rest);
  return rest;
}

export function poMonth(po) {
  const d = po.po_date || po.est_start || "";
  return d.length >= 7 ? d.slice(0, 7) : "";
}

export function rangesOverlap(s1, e1, s2, e2) {
  if (!s1 || !e1 || !s2 || !e2) return false;
  return s1 <= e2 && s2 <= e1;
}

export function filterPos(list, search, bucket, month) {
  let out = list;
  if (search) {
    const s = search.toLowerCase();
    out = out.filter((p) =>
      (p.po_number || "").toLowerCase().includes(s)
      || (p.client_name || "").toLowerCase().includes(s)
      || (p.item_type || "").toLowerCase().includes(s));
  }
  if (month) out = out.filter((p) => poMonth(p) === month);
  if (bucket) {
    if (bucket === "active") out = out.filter((p) => !p.computed.is_completed);
    else if (bucket === "completed") out = out.filter((p) => p.computed.is_completed);
    else out = out.filter((p) => p.computed.bucket === bucket);
  }
  return out;
}
