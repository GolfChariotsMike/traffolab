const CODE_EXT = /\.(?:[cm]?[jt]s|json)$/;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    const withExt = CODE_EXT.test(relative) ? relative : `${relative}.ts`;
    return nextResolve(new URL(`../${withExt}`, import.meta.url).href, context);
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !CODE_EXT.test(specifier.split("?")[0])
  ) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
