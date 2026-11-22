import type { LineupPosition, LineupTeamSize } from "@/types/lineup";

export interface FormationSlot {
  slot: number;
  position: LineupPosition;
  label: string;
  x: number;
  y: number;
}

interface RowSpec {
  position: LineupPosition;
  y: number;
  xs: number[];
  labels: string[];
}

export const SUPPORTED_TEAM_SIZES: readonly LineupTeamSize[] = [5, 6, 7, 8, 9, 10, 11];

/** 各人制预设阵型（顺序与后端保持一致，首项为默认阵型）。 */
export const FORMATIONS_BY_SIZE: Record<LineupTeamSize, readonly string[]> = {
  5: ["1-2-1", "2-2", "1-1-2", "2-1-1"],
  6: ["2-2-1", "2-1-2", "1-3-1"],
  7: ["2-3-1", "3-2-1", "2-2-2"],
  8: ["3-3-1", "2-3-2", "3-2-2", "2-4-1", "3-1-3"],
  9: ["3-3-2", "3-4-1", "4-3-1"],
  10: ["4-3-2", "3-4-2", "4-4-1"],
  11: ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"],
};

// 坐标约定：x 从左到右 0..1；y 从对方球门（0）到己方球门（1）。
// 门将放在 y=0.86，确保携带姓名与替补标签的圆点容器不触底钳制。
const GK: RowSpec = { position: "GK", y: 0.86, xs: [0.5], labels: ["门将"] };

const DEF_1: RowSpec = { position: "DF", y: 0.68, xs: [0.5], labels: ["后卫"] };
const DEF_2: RowSpec = { position: "DF", y: 0.69, xs: [0.29, 0.71], labels: ["左后卫", "右后卫"] };
const DEF_3: RowSpec = { position: "DF", y: 0.70, xs: [0.22, 0.5, 0.78], labels: ["左中卫", "中卫", "右中卫"] };
const DEF_4: RowSpec = {
  position: "DF",
  y: 0.71,
  xs: [0.14, 0.38, 0.62, 0.86],
  labels: ["左后卫", "左中卫", "右中卫", "右后卫"],
};
const DEF_5: RowSpec = {
  position: "DF",
  y: 0.70,
  xs: [0.10, 0.30, 0.5, 0.70, 0.90],
  labels: ["左翼卫", "左中卫", "中卫", "右中卫", "右翼卫"],
};

const FORMATION_ROWS: Record<string, RowSpec[]> = {
  // 5 人制
  "1-2-1": [
    GK,
    DEF_1,
    { position: "MF", y: 0.46, xs: [0.24, 0.76], labels: ["左中场", "右中场"] },
    { position: "FW", y: 0.21, xs: [0.5], labels: ["前锋"] },
  ],
  "2-2": [
    GK,
    { position: "DF", y: 0.63, xs: [0.28, 0.72], labels: ["左后卫", "右后卫"] },
    { position: "FW", y: 0.27, xs: [0.28, 0.72], labels: ["左前锋", "右前锋"] },
  ],
  "1-1-2": [
    GK,
    DEF_1,
    { position: "MF", y: 0.47, xs: [0.5], labels: ["中场"] },
    { position: "FW", y: 0.22, xs: [0.28, 0.72], labels: ["左前锋", "右前锋"] },
  ],
  "2-1-1": [
    GK,
    DEF_2,
    { position: "MF", y: 0.46, xs: [0.5], labels: ["中场"] },
    { position: "FW", y: 0.21, xs: [0.5], labels: ["前锋"] },
  ],

  // 6 人制
  "2-2-1": [
    GK,
    DEF_2,
    { position: "MF", y: 0.46, xs: [0.26, 0.74], labels: ["左中场", "右中场"] },
    { position: "FW", y: 0.21, xs: [0.5], labels: ["前锋"] },
  ],
  "2-1-2": [
    GK,
    DEF_2,
    { position: "MF", y: 0.47, xs: [0.5], labels: ["中场"] },
    { position: "FW", y: 0.22, xs: [0.28, 0.72], labels: ["左前锋", "右前锋"] },
  ],
  "1-3-1": [
    GK,
    DEF_1,
    { position: "MF", y: 0.46, xs: [0.20, 0.5, 0.80], labels: ["左中场", "中场", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.5], labels: ["前锋"] },
  ],

  // 7 人制
  "2-3-1": [
    GK,
    DEF_2,
    { position: "MF", y: 0.46, xs: [0.20, 0.5, 0.80], labels: ["左中场", "中场", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.5], labels: ["前锋"] },
  ],
  "3-2-1": [
    GK,
    DEF_3,
    { position: "MF", y: 0.46, xs: [0.30, 0.70], labels: ["左中场", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.5], labels: ["前锋"] },
  ],
  "2-2-2": [
    GK,
    DEF_2,
    { position: "MF", y: 0.47, xs: [0.26, 0.74], labels: ["左中场", "右中场"] },
    { position: "FW", y: 0.22, xs: [0.30, 0.70], labels: ["左前锋", "右前锋"] },
  ],

  // 8 人制
  "3-3-1": [
    GK,
    DEF_3,
    { position: "MF", y: 0.46, xs: [0.20, 0.5, 0.80], labels: ["左中场", "中场", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.5], labels: ["前锋"] },
  ],
  "2-3-2": [
    GK,
    DEF_2,
    { position: "MF", y: 0.46, xs: [0.20, 0.5, 0.80], labels: ["左中场", "中场", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.32, 0.68], labels: ["左前锋", "右前锋"] },
  ],
  "3-2-2": [
    GK,
    DEF_3,
    { position: "MF", y: 0.46, xs: [0.30, 0.70], labels: ["左中场", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.32, 0.68], labels: ["左前锋", "右前锋"] },
  ],
  "2-4-1": [
    GK,
    DEF_2,
    { position: "MF", y: 0.46, xs: [0.14, 0.38, 0.62, 0.86], labels: ["左中场", "左中前卫", "右中前卫", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.5], labels: ["前锋"] },
  ],
  "3-1-3": [
    GK,
    DEF_3,
    { position: "MF", y: 0.48, xs: [0.5], labels: ["后腰"] },
    { position: "FW", y: 0.22, xs: [0.20, 0.5, 0.80], labels: ["左边锋", "中锋", "右边锋"] },
  ],

  // 9 人制
  "3-3-2": [
    GK,
    DEF_3,
    { position: "MF", y: 0.46, xs: [0.20, 0.5, 0.80], labels: ["左中场", "中场", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.32, 0.68], labels: ["左前锋", "右前锋"] },
  ],
  "3-4-1": [
    GK,
    DEF_3,
    { position: "MF", y: 0.46, xs: [0.14, 0.38, 0.62, 0.86], labels: ["左中场", "左中前卫", "右中前卫", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.5], labels: ["前锋"] },
  ],
  "4-3-1": [
    GK,
    DEF_4,
    { position: "MF", y: 0.46, xs: [0.20, 0.5, 0.80], labels: ["左中场", "中场", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.5], labels: ["前锋"] },
  ],

  // 10 人制
  "4-3-2": [
    GK,
    DEF_4,
    { position: "MF", y: 0.46, xs: [0.20, 0.5, 0.80], labels: ["左中场", "中场", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.32, 0.68], labels: ["左前锋", "右前锋"] },
  ],
  "3-4-2": [
    GK,
    DEF_3,
    { position: "MF", y: 0.46, xs: [0.14, 0.38, 0.62, 0.86], labels: ["左中场", "左中前卫", "右中前卫", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.32, 0.68], labels: ["左前锋", "右前锋"] },
  ],
  "4-4-1": [
    GK,
    DEF_4,
    { position: "MF", y: 0.46, xs: [0.14, 0.38, 0.62, 0.86], labels: ["左中场", "左中前卫", "右中前卫", "右中场"] },
    { position: "FW", y: 0.20, xs: [0.5], labels: ["前锋"] },
  ],

  // 11 人制
  "4-3-3": [
    GK,
    DEF_4,
    { position: "MF", y: 0.48, xs: [0.22, 0.5, 0.78], labels: ["左中场", "中场", "右中场"] },
    { position: "FW", y: 0.23, xs: [0.18, 0.82], labels: ["左边锋", "右边锋"] },
    { position: "FW", y: 0.16, xs: [0.5], labels: ["中锋"] },
  ],
  "4-4-2": [
    GK,
    DEF_4,
    { position: "MF", y: 0.47, xs: [0.14, 0.38, 0.62, 0.86], labels: ["左中场", "左中前卫", "右中前卫", "右中场"] },
    { position: "FW", y: 0.19, xs: [0.33, 0.67], labels: ["左前锋", "右前锋"] },
  ],
  "4-2-3-1": [
    GK,
    DEF_4,
    { position: "MF", y: 0.55, xs: [0.34, 0.66], labels: ["左后腰", "右后腰"] },
    { position: "MF", y: 0.36, xs: [0.18, 0.5, 0.82], labels: ["左前腰", "前腰", "右前腰"] },
    { position: "FW", y: 0.16, xs: [0.5], labels: ["前锋"] },
  ],
  "3-5-2": [
    GK,
    DEF_3,
    { position: "MF", y: 0.53, xs: [0.32, 0.68], labels: ["左中场", "右中场"] },
    { position: "MF", y: 0.48, xs: [0.11, 0.89], labels: ["左翼卫", "右翼卫"] },
    { position: "MF", y: 0.37, xs: [0.5], labels: ["前腰"] },
    { position: "FW", y: 0.18, xs: [0.33, 0.67], labels: ["左前锋", "右前锋"] },
  ],
  "3-4-3": [
    GK,
    DEF_3,
    { position: "MF", y: 0.47, xs: [0.14, 0.38, 0.62, 0.86], labels: ["左中场", "左中前卫", "右中前卫", "右中场"] },
    { position: "FW", y: 0.23, xs: [0.18, 0.82], labels: ["左边锋", "右边锋"] },
    { position: "FW", y: 0.16, xs: [0.5], labels: ["中锋"] },
  ],
  "5-3-2": [
    GK,
    DEF_5,
    { position: "MF", y: 0.46, xs: [0.22, 0.5, 0.78], labels: ["左中场", "中场", "右中场"] },
    { position: "FW", y: 0.19, xs: [0.33, 0.67], labels: ["左前锋", "右前锋"] },
  ],
};

/** 赛制钳制/规范化：支持 5..11 人制，缺省或超范围回落 5 人制。 */
export function normalizePlayersPerTeam(playersPerTeam: number | null | undefined): LineupTeamSize {
  if (typeof playersPerTeam === "number" && Number.isInteger(playersPerTeam) && playersPerTeam >= 5 && playersPerTeam <= 11) {
    return playersPerTeam as LineupTeamSize;
  }
  return 5;
}

export function getFormationOptions(playersPerTeam: number | null | undefined): readonly string[] {
  return FORMATIONS_BY_SIZE[normalizePlayersPerTeam(playersPerTeam)];
}

export function getDefaultFormation(playersPerTeam: number | null | undefined): string {
  return getFormationOptions(playersPerTeam)[0];
}

export function isValidFormation(playersPerTeam: number | null | undefined, code: string): boolean {
  return getFormationOptions(playersPerTeam).includes(code);
}

/** 返回指定人制与阵型的所有默认槽位（序号 0 固定为门将）。 */
export function getFormation(playersPerTeam: number | null | undefined, code?: string): FormationSlot[] {
  const size = normalizePlayersPerTeam(playersPerTeam);
  const options = FORMATIONS_BY_SIZE[size];
  const resolvedCode = code && options.includes(code) ? code : options[0];
  const rows = FORMATION_ROWS[resolvedCode];
  const result: FormationSlot[] = [];
  let slot = 0;
  for (const row of rows) {
    row.xs.forEach((x, index) => {
      result.push({
        slot,
        position: row.position,
        label: row.labels[index],
        x,
        y: row.y,
      });
      slot += 1;
    });
  }
  return result;
}
