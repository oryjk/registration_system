import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onChange: (page: number, pageSize: number) => void;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onChange,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  return (
    <nav aria-label="分页" className="pagination-bar">
      <span className="pagination-total">共 {total} 条</span>
      <div className="pagination-controls">
        <Button
          aria-label="上一页"
          disabled={currentPage <= 1}
          onClick={() => onChange(currentPage - 1, pageSize)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronLeft size={15} />
        </Button>
        <span className="pagination-page">
          第 {currentPage} / {totalPages} 页
        </span>
        <Button
          aria-label="下一页"
          disabled={currentPage >= totalPages}
          onClick={() => onChange(currentPage + 1, pageSize)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronRight size={15} />
        </Button>
      </div>
      <div className="pagination-size">
        每页
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onChange(1, Number(value))}
        >
          <SelectTrigger aria-label="每页条数">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        条
      </div>
    </nav>
  );
}
