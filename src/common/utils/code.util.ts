/**
 * Sinh mã chứng từ dạng người-đọc-được: PREFIX + yyMMdd + số thứ tự trong ngày.
 * Ví dụ: DH240914001. `seq` là số bản ghi cùng loại đã tạo trong ngày (đếm trong transaction).
 */
export function buildDailyCode(prefix: string, date: Date, seq: number): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${prefix}${yy}${mm}${dd}${String(seq).padStart(3, '0')}`;
}

/** Khoảng [đầu ngày, đầu ngày hôm sau) theo giờ local — dùng cho filter/đếm theo ngày. */
export function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
