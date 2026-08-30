import { ChevronDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TeamOption } from "@/types/team";

interface TeamSelectFieldProps {
  value: number | undefined;
  onChange: (teamId: number | undefined) => void;
  teams: TeamOption[];
  searchValue: string;
  onSearchChange: (search: string) => void;
  onCreateTeam: (name: string) => void;
  disabled?: boolean;
  creating?: boolean;
}

/** 主队选择：可搜索下拉 + 搜索无匹配时内联创建球队。 */
export function TeamSelectField({
  value,
  onChange,
  teams,
  searchValue,
  onSearchChange,
  onCreateTeam,
  disabled,
  creating,
}: TeamSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const keyword = searchValue.trim().toLocaleLowerCase("zh-CN");
  const filtered = useMemo(
    () =>
      keyword
        ? teams.filter((team) =>
            team.name.toLocaleLowerCase("zh-CN").includes(keyword),
          )
        : teams,
    [teams, keyword],
  );
  const selected = teams.find((team) => team.id === value);

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onSearchChange("");
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button
          aria-label="选择主队"
          className="team-select-trigger"
          disabled={disabled}
          type="button"
          variant="outline"
        >
          <span className="team-select-label">
            {selected?.name || (teams.length ? "选择主队" : "暂无可用球队")}
          </span>
          <ChevronDown size={15} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="team-select-popover">
        <Input
          aria-label="搜索球队"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索球队名称"
          value={searchValue}
        />
        <div className="team-select-list" role="listbox">
          {filtered.map((team) => (
            <button
              aria-selected={team.id === value}
              className="team-select-option"
              data-active={team.id === value}
              key={team.id}
              onClick={() => {
                onChange(team.id);
                onSearchChange("");
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              {team.name}
            </button>
          ))}
          {filtered.length === 0 ? (
            <div className="team-select-empty">
              <span>
                {searchValue.trim()
                  ? `未找到“${searchValue.trim()}”`
                  : "暂无球队"}
              </span>
              {searchValue.trim() ? (
                <Button
                  disabled={creating}
                  onClick={() => onCreateTeam(searchValue.trim())}
                  size="sm"
                  type="button"
                  variant="link"
                >
                  <Plus size={14} />
                  创建球队
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
