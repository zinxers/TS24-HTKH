/** Lưu blob thành file qua thẻ <a download> (dùng chung cho WR/MR/QR và đối soát). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  // Trình duyệt bắt đầu tải bất đồng bộ: thu hồi URL sau một lúc.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
