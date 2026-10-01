import { Info, RotateCw } from "lucide-react";
import { ErrorAlert } from "@/components/admin/error-alert";
import { PaginationBar } from "@/components/admin/pagination-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWeChatUsersQuery } from "@/hooks/queries/useUserQueries";
import { useUserListControls } from "@/hooks/useUserListControls";
import { UserDirectoryFilters } from "./user-list/UserDirectoryFilters";
import { UserDirectoryTable } from "./user-list/UserDirectoryTable";

export default function UserListPage() {
  const controls = useUserListControls();
  const users = useWeChatUsersQuery(controls.query);
  const error = users.error instanceof Error ? users.error.message : "";

  return (
    <div className="content-grid user-directory-page">
      <Card className="user-directory-card">
        <CardHeader className="user-directory-header">
          <div className="user-directory-heading">
            <div className="user-directory-title">
              <CardTitle>用户列表</CardTitle>
              <span aria-live="polite" className="user-directory-count">
                {users.data?.total ?? "—"}
                <span>位用户</span>
              </span>
            </div>
            <CardDescription>
              查看小程序用户资料、身份与最近使用情况
            </CardDescription>
          </div>
          <div className="user-directory-actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="活跃时间说明"
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Info aria-hidden="true" size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                活跃时间最多每 30 分钟更新一次，可能略有延迟。
              </TooltipContent>
            </Tooltip>
            <Button
              disabled={users.isFetching}
              onClick={() => void users.refetch()}
              type="button"
              variant="outline"
            >
              <RotateCw
                aria-hidden="true"
                className={users.isFetching ? "animate-spin" : undefined}
                size={15}
              />
              刷新列表
            </Button>
          </div>
        </CardHeader>
        <UserDirectoryFilters
          hasFilters={controls.hasFilters}
          onQueryChange={controls.updateQuery}
          onReset={controls.resetFilters}
          onSearch={controls.submitSearch}
          onSearchChange={controls.setSearchDraft}
          query={controls.query}
          searchDraft={controls.searchDraft}
        />
        <CardContent
          aria-busy={users.isFetching}
          className="user-directory-content"
        >
          {error ? (
            <ErrorAlert message={error} onRetry={() => void users.refetch()} />
          ) : null}
          <UserDirectoryTable
            filtered={controls.hasAppliedFilters}
            loading={users.isLoading}
            onSort={controls.toggleSort}
            sortDirection={controls.sortDirection}
            users={users.data?.items || []}
          />
          <PaginationBar
            onChange={(page, pageSize) =>
              controls.updateQuery({ page, page_size: pageSize })
            }
            page={users.data?.page || controls.query.page}
            pageSize={users.data?.page_size || controls.query.page_size}
            total={users.data?.total || 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
