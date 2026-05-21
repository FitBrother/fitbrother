module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Reanimated v4 split its babel plugin into react-native-worklets.
    // Must be listed last (Reanimated docs).
    plugins: ["react-native-worklets/plugin"],
  };
};
