const bunTest: any = await import("bun:test");
const { expect, test } = bunTest;
import { baseParse } from "@vue/compiler-dom";
import { parse } from "@vue/compiler-sfc";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: { file(path: string): { text(): Promise<string> } };

/** 执行真实模板条件，再经过 uni-app 的小程序 patch/setData，防止组件实例进入视图数据。 */
test("the home tour mount flag stays serializable when its target scope is a live mini-program component", async () => {
  const source = await Bun.file(miniPath("src/pages/home/index.vue")).text();
  const template = baseParse(parse(source).descriptor.template!.content);
  function findTour(node: any): any {
    if (node.tag === "HomeOnboardingTour") return node;
    for (const child of node.children ?? []) {
      const found = findTour(child);
      if (found) return found;
    }
  }
  const condition = findTour(template).props.find((prop: any) => prop.type === 7 && prop.name === "if").exp.content;
  const evaluate = new Function("homeTour", "tourScope", `return (${condition});`);
  const flags = ["__VUE_OPTIONS_API__", "__VUE_PROD_DEVTOOLS__", "__VUE_CREATED_DEFERRED__"];
  const globals = globalThis as unknown as Record<string, unknown>;
  const originalFlags = flags.map(flag => globals[flag]);
  flags.forEach(flag => { globals[flag] = false; });
  const runtime = await import(miniPath("node_modules/@dcloudio/uni-mp-vue/dist/vue.runtime.esm.js"));
  const app = runtime.createVueApp({});
  app.config.globalProperties.pruneComponentPropsCache = runtime.pruneComponentPropsCache;
  const root = app.mount();
  let component: any;
  try {
    component = root.$createComponent({ type: { setup: () => () => ({}) } }, {
      mpType: "component",
      parentComponent: root.$,
      onBeforeSetup(instance: any) {
        instance.ctx.mpType = "component";
        // 微信组件句柄持有 $vm，真实查询 scope 必然是一个有环的对象。
        instance.ctx.$scope = { data: {}, $vm: instance.proxy, selectAllComponents: () => [], setData: (_: unknown, done: () => void) => done() };
      },
    });
    component.$scope.$vm = component;
    for (const [active, scope, expected] of [[true, component, true], [false, component, false], [true, undefined, false]]) {
      let transported: any;
      let serializationError: string | null = null;
      runtime.patch({ ctx: { mpType: "page", $scope: { data: {}, setData(data: unknown, done: () => void) {
        try { transported = JSON.parse(JSON.stringify(data)); }
        catch (error) { serializationError = (error as Error).message; }
        done();
      } } } }, { tourMounted: evaluate({ active: { value: active } }, scope) });
      expect(serializationError).toEqual(null);
      expect(transported?.tourMounted).toEqual(expected);
    }
  } finally {
    if (component) root.$destroyComponent(component);
    flags.forEach((flag, index) => {
      if (originalFlags[index] === undefined) delete globals[flag];
      else globals[flag] = originalFlags[index];
    });
  }
});
