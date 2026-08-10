import type { AppWalletAccount } from "@/types/wallet";
import { requestApi } from "@/utils/request";

export function getWallet() {
  return requestApi<AppWalletAccount>({ url: "/wallet", auth: true });
}
