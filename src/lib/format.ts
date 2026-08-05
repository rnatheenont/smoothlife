export function formatTHB(amount: number) {
  return `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9ก-๙\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function genOrderId() {
  const d = new Date();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SL${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${rand}`;
}
