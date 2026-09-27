interface PageEntry {
  path: string;
  style?: { navigationStyle?: string; navigationBarTitleText?: string };
}

/** Tests must inspect both main-package and subpackage routes. */
export function registeredPages(config: {
  pages: PageEntry[];
  subPackages?: { root: string; pages: PageEntry[] }[];
}): PageEntry[] {
  return [
    ...config.pages,
    ...(config.subPackages ?? []).flatMap((subpackage) => subpackage.pages.map((page) => ({
      ...page,
      path: `${subpackage.root}/${page.path}`,
    }))),
  ];
}
