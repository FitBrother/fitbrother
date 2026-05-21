// Workspace monorepo entry: expo-router is hoisted to the root node_modules
// and the Expo CLI doesn't walk up directories when resolving the package.json
// `main`. Importing through this local file lets Metro's resolver handle it.
import "expo-router/entry";
