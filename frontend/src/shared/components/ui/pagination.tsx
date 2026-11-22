import { Button } from './button';

export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  if (count < 2 && page === 1) return null;
  return (
    <nav aria-label="Phân trang" className="mt-5 flex items-center gap-3 text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Trang trước
      </Button>
      <span>
        Trang {page} / {count}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= count}
        onClick={() => onChange(page + 1)}
      >
        Trang sau
      </Button>
    </nav>
  );
}
