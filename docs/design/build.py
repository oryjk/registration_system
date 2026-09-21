#!/usr/bin/env python3
"""把 home-redesign 模板构建为自包含 HTML（内嵌截图与头像 base64）。

用法：python3 docs/design/build.py
输入：home-redesign-2026-09-20.template.html + assets/
输出：home-redesign-2026-09-20.html（可直接双击打开，无外部依赖）
"""
import base64
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
TEMPLATE = ROOT / "home-redesign-2026-09-20.template.html"
OUTPUT = ROOT / "home-redesign-2026-09-20.html"

PLACEHOLDERS = {
    "HOME_TOP": (ROOT / "assets/home-top.png", "image/png"),
    "HOME_CARDS": (ROOT / "assets/home-cards.png", "image/png"),
    "HOME_TABBAR": (ROOT / "assets/home-tabbar.png", "image/png"),
    "TEAMLOGO": (ROOT / "assets/avatars/team.jpg", "image/jpeg"),
}


def b64(path: pathlib.Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    src = TEMPLATE.read_text(encoding="utf-8")
    for i in range(1, 9):
        PLACEHOLDERS[f"AV{i}"] = (ROOT / f"assets/avatars/a{i}.jpg", "image/jpeg")

    for name, (path, mime) in PLACEHOLDERS.items():
        if not path.exists():
            sys.exit(f"missing asset: {path}")
        src = src.replace("{{" + name + "}}", b64(path, mime))

    if "{{" in src:
        sys.exit("unresolved placeholder remains")
    OUTPUT.write_text(src, encoding="utf-8")
    print(f"built {OUTPUT.name} ({OUTPUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
