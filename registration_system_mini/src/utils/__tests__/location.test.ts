import { describe, expect, test } from "bun:test";
import {
  buildTencentReverseGeocodeUrl,
  isOpenLocationSupported,
  resolveTencentLocationLabel,
} from "../location";

describe("buildTencentReverseGeocodeUrl", () => {
  test("builds a tencent geocoder request with lat lng and key", () => {
    expect(buildTencentReverseGeocodeUrl("test-key", 30.5728, 104.0668)).toEqual(
      "https://apis.map.qq.com/ws/geocoder/v1/?location=30.5728,104.0668&key=test-key&get_poi=0",
    );
  });
});

describe("resolveTencentLocationLabel", () => {
  test("prefers district over city for compact header display", () => {
    expect(
      resolveTencentLocationLabel({
        status: 0,
        result: {
          address: "四川省成都市武侯区天府大道北段 1 号",
          address_component: {
            province: "四川省",
            city: "成都市",
            district: "武侯区",
          },
        },
      }),
    ).toEqual({
      label: "武侯区",
      city: "成都市",
      district: "武侯区",
      address: "四川省成都市武侯区天府大道北段 1 号",
    });
  });

  test("falls back to city when district is missing", () => {
    expect(
      resolveTencentLocationLabel({
        status: 0,
        result: {
          address: "四川省成都市",
          address_component: {
            province: "四川省",
            city: "成都市",
            district: "",
          },
        },
      }),
    ).toEqual({
      label: "成都市",
      city: "成都市",
      district: "",
      address: "四川省成都市",
    });
  });

  test("returns a stable fallback for failed geocoder responses", () => {
    expect(resolveTencentLocationLabel({ status: 120, message: "invalid key" })).toEqual({
      label: "当前位置",
      city: "",
      district: "",
      address: "",
    });
  });
});

describe("isOpenLocationSupported", () => {
  test("returns false in wechat devtools", () => {
    expect(isOpenLocationSupported("devtools")).toEqual(false);
  });

  test("returns true on real device platforms", () => {
    expect(isOpenLocationSupported("ios")).toEqual(true);
    expect(isOpenLocationSupported("android")).toEqual(true);
  });
});
