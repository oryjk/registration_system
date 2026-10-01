import { RotateCcw, Search } from "lucide-react";
import { FilterSelect } from "@/components/admin/list-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  WeChatUserActivity,
  WeChatUserIdentityFilter,
  WeChatUserListQuery,
  WeChatUserStatusFilter,
} from "@/types/user";

interface UserDirectoryFiltersProps {
  query: WeChatUserListQuery;
  searchDraft: string;
  hasFilters: boolean;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onQueryChange: (changes: Partial<WeChatUserListQuery>) => void;
}

export function UserDirectoryFilters({
  query,
  searchDraft,
  hasFilters,
  onSearchChange,
  onSearch,
  onReset,
  onQueryChange,
}: UserDirectoryFiltersProps) {
  return (
    <section aria-label="搜索与筛选用户" className="user-directory-filters">
      <search>
        <form
          className="user-directory-search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <Input
            aria-label="搜索微信用户"
            autoComplete="off"
            className="user-directory-search-input"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索昵称、姓名、手机号或用户 ID"
            value={searchDraft}
          />
          <Button type="submit">
            <Search aria-hidden="true" size={15} />
            搜索
          </Button>
          <Button
            disabled={!hasFilters}
            onClick={onReset}
            type="button"
            variant="outline"
          >
            <RotateCcw aria-hidden="true" size={15} />
            重置筛选
          </Button>
        </form>
      </search>
      <div className="user-directory-filter-grid">
        <div className="user-directory-filter-field">
          <span>活跃状态</span>
          <FilterSelect
            ariaLabel="筛选用户活跃状态"
            onValueChange={(value) =>
              onQueryChange({ page: 1, activity: value as WeChatUserActivity })
            }
            options={[
              { value: "all", label: "全部活跃状态" },
              { value: "active_7d", label: "近 7 天活跃" },
              { value: "inactive_30d", label: "30 天未活跃" },
              { value: "never", label: "从未记录" },
            ]}
            placeholder="全部活跃状态"
            value={query.activity || "all"}
          />
        </div>
        <div className="user-directory-filter-field">
          <span>账号状态</span>
          <FilterSelect
            ariaLabel="筛选用户账号状态"
            onValueChange={(value) =>
              onQueryChange({
                page: 1,
                status: value as WeChatUserStatusFilter,
              })
            }
            options={[
              { value: "all", label: "全部账号状态" },
              { value: "active", label: "正常" },
              { value: "frozen", label: "已冻结" },
            ]}
            placeholder="全部账号状态"
            value={query.status || "all"}
          />
        </div>
        <div className="user-directory-filter-field">
          <span>用户身份</span>
          <FilterSelect
            ariaLabel="筛选用户身份"
            onValueChange={(value) =>
              onQueryChange({
                page: 1,
                identity: value as WeChatUserIdentityFilter,
              })
            }
            options={[
              { value: "all", label: "全部身份" },
              { value: "match_admin", label: "比赛管理员" },
              { value: "normal", label: "普通用户" },
            ]}
            placeholder="全部身份"
            value={query.identity || "all"}
          />
        </div>
      </div>
    </section>
  );
}
