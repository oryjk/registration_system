import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { WeChatUserListQuery, WeChatUserSort } from "@/types/user";
import {
  parseUserListQuery,
  serializeUserListQuery,
} from "@/utils/user-list-query";

/** 用户目录查询以 URL 为准，搜索草稿在明确提交后才参与查询。 */
export function useUserListControls() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = {
    ...parseUserListQuery(location.search),
    match_admin_only: false,
  };
  const [searchDraft, setSearchDraft] = useState(query.search || "");

  useEffect(() => setSearchDraft(query.search || ""), [query.search]);

  const updateQuery = (changes: Partial<WeChatUserListQuery>) => {
    navigate(
      `/users${serializeUserListQuery({ ...query, ...changes, match_admin_only: false })}`,
    );
  };
  const activeSort = query.sort || "last_active_desc";
  const toggleSort = (column: "last_active" | "created") => {
    const sort: WeChatUserSort =
      activeSort === `${column}_desc` ? `${column}_asc` : `${column}_desc`;
    updateQuery({ page: 1, sort });
  };
  const sortDirection = (
    column: "last_active" | "created",
  ): "asc" | "desc" | null => {
    if (activeSort === `${column}_asc`) return "asc";
    if (activeSort === `${column}_desc`) return "desc";
    return null;
  };
  const hasAppliedFilters = Boolean(
    query.search ||
      query.activity !== "all" ||
      query.status !== "all" ||
      query.identity !== "all",
  );

  return {
    query,
    searchDraft,
    setSearchDraft,
    updateQuery,
    toggleSort,
    sortDirection,
    hasAppliedFilters,
    hasFilters: hasAppliedFilters || Boolean(searchDraft.trim()),
    submitSearch: () => updateQuery({ page: 1, search: searchDraft.trim() }),
    resetFilters: () => {
      setSearchDraft("");
      updateQuery({
        page: 1,
        search: undefined,
        activity: "all",
        status: "all",
        identity: "all",
      });
    },
  };
}
