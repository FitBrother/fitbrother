import { Easing } from "react-native-reanimated";

export const Motion = {
  // Durações em milissegundos.
  duration: {
    fast: 150,
    base: 250,
    slow: 400,
  },
  easing: {
    standard: Easing.bezier(0.4, 0, 0.2, 1),
    decelerate: Easing.bezier(0, 0, 0.2, 1),
    accelerate: Easing.bezier(0.4, 0, 1, 1),
  },
} as const;
