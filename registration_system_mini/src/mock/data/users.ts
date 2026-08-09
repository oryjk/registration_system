import type { BackendUser, BackendUserActivityRecord } from "@/types/backend";

/**
 * Mock 用户数据。
 *
 * 当前登录用户为 id=37 王睿（洺悦御府队长），与 Go 后端测试登录默认用户一致。
 * 其他用户取自现有原型数据（曾俊、王洪等），用于首页报名头像展示。
 */
export const mockCurrentUser: BackendUser = {
  id: 37,
  open_id: "mock-openid-wangrui",
  username: "wangrui",
  nickname: "王睿",
  real_name: "王睿",
  // Mock 直接走本地头像回退，避免依赖外部占位图服务。
  avatar_url: "",
  phone_number: "138****8888",
  is_manager: false,
  is_venue: false,
};

export const mockUsers: BackendUser[] = [
  mockCurrentUser,
  { id: 1, open_id: "u1", username: "zengjun", nickname: "曾俊", real_name: "曾俊", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 2, open_id: "u2", username: "wanghong", nickname: "阿洪", real_name: "王洪", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 3, open_id: "u3", username: "guiqiang", nickname: "东安利马", real_name: "桂强", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 4, open_id: "u4", username: "lvhonggui", nickname: "叶知秋", real_name: "吕红贵", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 5, open_id: "u5", username: "tangs", nickname: "阿慧", real_name: "唐斯慧", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 6, open_id: "u6", username: "chenpingyan", nickname: "界牌辅十八号", real_name: "陈平严", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 7, open_id: "u7", username: "sunjianfeng", nickname: "贝壳", real_name: "孙剑峰", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 8, open_id: "u8", username: "jiangjinghong", nickname: "会说话的哑巴", real_name: "蒋景洪", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 9, open_id: "u9", username: "xunyong", nickname: "寻勇", real_name: "寻勇", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 10, open_id: "u10", username: "zhaochuanjiang", nickname: "小赵", real_name: "赵川江", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 11, open_id: "u11", username: "xuetianzheng", nickname: "薛田正", real_name: "薛田正", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 12, open_id: "u12", username: "zhangkeyi", nickname: "张可以", real_name: "张可以", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 13, open_id: "u13", username: "wujiaxin", nickname: "A昕然", real_name: "吴家昕", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 14, open_id: "u14", username: "akuan", nickname: "阿宽", real_name: "阿宽", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 15, open_id: "u15", username: "laozhou", nickname: "老周", real_name: "老周", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 16, open_id: "u16", username: "xiaoyang", nickname: "小杨", real_name: "小杨", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 17, open_id: "u17", username: "aqiang", nickname: "阿强", real_name: "阿强", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
  { id: 18, open_id: "u18", username: "dahai", nickname: "大海", real_name: "大海", avatar_url: "", phone_number: "", is_manager: false, is_venue: false },
];

export function findMockUser(userId: number): BackendUser | undefined {
  return mockUsers.find((item) => item.id === userId);
}

/** 当前用户（id=37）的报名记录，用于首页"我的比赛"和报名状态展示 */
export const mockMyActivities: BackendUserActivityRecord[] = [
  { activity_id: "act-001", user_id: 37, stand: 1, registration_count: 1, operation_time: "2026-08-07 10:00:00" },
  { activity_id: "act-002", user_id: 37, stand: 0, registration_count: 0, operation_time: "2026-08-07 10:00:00" },
];
