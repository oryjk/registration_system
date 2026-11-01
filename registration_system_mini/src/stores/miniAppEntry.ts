import { ref } from "vue";

const entryVersion = ref(0);

/** App 前台进入次数，与页面 onShow（切 Tab/返回首页）独立。 */
export function beginMiniAppEntry(): void { entryVersion.value++; }
export function useMiniAppEntry() { return { entryVersion }; }
