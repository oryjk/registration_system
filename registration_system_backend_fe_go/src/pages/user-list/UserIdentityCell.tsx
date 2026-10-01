import { MemberCell } from "@/components/admin/member-cell";
import type { WeChatUser } from "@/types/user";

/** 名称优先、真实姓名与编号置于同一副行，避免重复姓名和三行高度。 */
export function UserIdentityCell({ user }: { user: WeChatUser }) {
  const name = user.nickname || `用户 ${user.id}`;
  const realName = user.real_name?.trim();
  return (
    <MemberCell
      avatarUrl={user.avatar_url}
      metadata={
        <>
          {realName && realName !== name.trim() ? (
            <span className="member-cell-real-name" title={realName}>
              {realName}
            </span>
          ) : null}
          <span className="member-cell-id">ID {user.id}</span>
        </>
      }
      name={name}
    />
  );
}
