/** Khung chờ khi chưa có người dùng: tiêu đề + 4 thẻ + 1 bảng. */
export function PageSkeleton() {
  return (
    <div className="skel" role="status" aria-busy="true" aria-label="Đang tải">
      <span className="sk sk-title" />
      <div className="sk-cards">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="sk" />
        ))}
      </div>
      <div className="sk-tbl">
        <span className="sk" style={{ width: '40%' }} />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="sk" />
        ))}
        <span className="sk" style={{ width: '70%' }} />
      </div>
    </div>
  );
}
