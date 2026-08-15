const bunTest: any = await import("bun:test");
const { expect, mock, test } = bunTest;

const capturedCalls: unknown[] = [];
const requestApi = async (options: unknown) => {
  capturedCalls.push(options);
  return {};
};

mock.module("@/utils/request", () => ({ requestApi }));

const walletModule = await import("../wallet").catch(() => ({}));

test("loads the authenticated wallet account", async () => {
  const getWallet = (walletModule as { getWallet?: () => Promise<unknown> }).getWallet;
  expect(typeof getWallet).toEqual("function");

  capturedCalls.length = 0;
  await getWallet!();

  expect(capturedCalls[0]).toEqual({ url: "/wallet", auth: true });
});

export {};
