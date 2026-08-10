function pathFrom(base: URL, relativePath: string) {
  return decodeURIComponent(new URL(relativePath, base).pathname);
}

const sourceRoot = new URL("../", import.meta.url);
const miniRoot = new URL("../../", import.meta.url);
const workspaceRoot = new URL("../../../", import.meta.url);

export function sourcePath(relativePath: string) {
  return pathFrom(sourceRoot, relativePath);
}

export function miniPath(relativePath: string) {
  return pathFrom(miniRoot, relativePath);
}

export function workspacePath(relativePath: string) {
  return pathFrom(workspaceRoot, relativePath);
}
