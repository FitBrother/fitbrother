import type { ConfigContext, ExpoConfig } from "expo/config";

const isDev = process.env.APP_VARIANT === "development";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  name: isDev ? "Fitbrother Dev" : (config.name ?? "Fitbrother"),
  scheme: isDev ? "fitbrother-dev" : config.scheme,
  ios: {
    ...config.ios,
    bundleIdentifier: isDev ? "com.fitbrother.app.dev" : config.ios?.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: isDev ? "com.fitbrother.app.dev" : config.android?.package,
  },
});
