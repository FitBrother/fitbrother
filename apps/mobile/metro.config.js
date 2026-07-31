const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
const defaultResolveRequest = config.resolver.resolveRequest;

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // The shared package is authored as NodeNext TypeScript, so its source uses
  // runtime `.js` specifiers even though Metro consumes the adjacent `.ts`
  // files directly through the package's react-native export.
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    const typescriptPath = path.resolve(
      path.dirname(context.originModulePath),
      moduleName.replace(/\.js$/, ".ts"),
    );
    if (fs.existsSync(typescriptPath)) {
      return { type: "sourceFile", filePath: typescriptPath };
    }
  }

  if (
    moduleName === "semver/functions/satisfies" ||
    moduleName === "semver/functions/prerelease"
  ) {
    return {
      type: "sourceFile",
      filePath: require.resolve(`${moduleName}.js`, { paths: [projectRoot] }),
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
