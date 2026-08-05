import { configUmiAlias, createConfig } from "@umijs/max/test.js";

export default async () => {
  return configUmiAlias({
    ...createConfig({ target: "browser" }),
    testEnvironmentOptions: {
      url: "http://localhost:8000",
    },
  });
};
