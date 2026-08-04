import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const metricNames = [
  "domContentLoadedMs",
  "fcpMs",
  "loadMs",
  "requestCount",
  "transferBytes",
];

export function median(values) {
  if (!values.length || values.some((value) => !Number.isFinite(value))) {
    throw new Error("median requires finite samples");
  }

  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function parseTargets(values) {
  if (!values.length) {
    throw new Error("Provide at least one target in name=url form");
  }

  const targets = values.map((value) => {
    const separator = value.indexOf("=");
    const name = value.slice(0, separator);
    const url = value.slice(separator + 1);
    if (separator <= 0 || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(`Invalid target ${value}; expected name=url`);
    }

    const parsedURL = new URL(url);
    if (!new Set(["http:", "https:"]).has(parsedURL.protocol)) {
      throw new Error(`Target ${name} must use http or https`);
    }

    return { name, url: parsedURL.toString() };
  });

  if (new Set(targets.map((target) => target.name)).size !== targets.length) {
    throw new Error("Target names must be unique");
  }

  return targets;
}

export function parseArguments(args) {
  const targetValues = [];
  let runs = 7;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--runs") {
      runs = Number(args[index + 1]);
      index += 1;
    } else if (args[index] !== "--") {
      targetValues.push(args[index]);
    }
  }

  if (!Number.isSafeInteger(runs) || runs <= 0) {
    throw new Error("--runs must be a positive integer");
  }

  return { runs, targets: parseTargets(targetValues) };
}

async function measureSample(browser, target, run) {
  const context = await browser.newContext();
  try {
    const unauthorized = (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          code: 40101,
          message: "未登录或登录已过期",
          data: null,
        }),
      });
    await context.route("**/api/**", unauthorized);
    await context.route("**/health**", unauthorized);

    const page = await context.newPage();
    await page.goto(target.url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      const firstContentfulPaint = performance.getEntriesByName(
        "first-contentful-paint",
      )[0];
      const transferBytes = [navigation, ...resources].reduce(
        (total, entry) =>
          total + ("transferSize" in entry ? entry.transferSize : 0),
        0,
      );

      return {
        domContentLoadedMs: Math.round(
          "domContentLoadedEventEnd" in navigation
            ? navigation.domContentLoadedEventEnd
            : 0,
        ),
        fcpMs: Math.round(firstContentfulPaint?.startTime || 0),
        loadMs: Math.round(
          "loadEventEnd" in navigation ? navigation.loadEventEnd : 0,
        ),
        requestCount: resources.length + 1,
        transferBytes,
      };
    });

    return { run, ...metrics };
  } finally {
    await context.close();
  }
}

export async function measureTargets({ targets, runs }) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const samples = Object.fromEntries(
    targets.map((target) => [target.name, []]),
  );

  try {
    for (let run = 1; run <= runs; run += 1) {
      const order = run % 2 === 1 ? targets : targets.toReversed();
      for (const target of order) {
        samples[target.name].push(await measureSample(browser, target, run));
      }
    }
  } finally {
    await browser.close();
  }

  return {
    runs,
    targets: targets.map((target) => ({
      ...target,
      medians: Object.fromEntries(
        metricNames.map((metric) => [
          metric,
          median(samples[target.name].map((sample) => sample[metric])),
        ]),
      ),
      samples: samples[target.name],
    })),
  };
}

async function main(args) {
  const options = parseArguments(args);
  const result = await measureTargets(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  });
}
