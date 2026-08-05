import assert from "node:assert/strict";
import test from "node:test";
import {
  median,
  parseArguments,
  parseTargets,
} from "./measure-login-performance.mjs";

test("median returns the middle sorted sample", () => {
  assert.equal(median([416, 388, 400, 420, 396]), 400);
  assert.equal(median([10, 4, 8, 6]), 7);
});

test("parseTargets accepts explicit name=url pairs", () => {
  assert.deepEqual(parseTargets(["v5=http://127.0.0.1:5191/login"]), [
    { name: "v5", url: "http://127.0.0.1:5191/login" },
  ]);
});

test("parseArguments extracts the run count and multiple targets", () => {
  assert.deepEqual(
    parseArguments([
      "v5=http://127.0.0.1:5191/login",
      "v6=http://127.0.0.1:5192/login",
      "--runs",
      "9",
    ]),
    {
      runs: 9,
      targets: [
        { name: "v5", url: "http://127.0.0.1:5191/login" },
        { name: "v6", url: "http://127.0.0.1:5192/login" },
      ],
    },
  );
});

test("argument parsing rejects duplicate names and invalid run counts", () => {
  assert.throws(
    () =>
      parseTargets([
        "v6=http://127.0.0.1:5191/login",
        "v6=http://127.0.0.1:5192/login",
      ]),
    /Target names must be unique/,
  );
  assert.throws(
    () => parseArguments(["v6=http://127.0.0.1:5192/login", "--runs", "0"]),
    /--runs must be a positive integer/,
  );
});
