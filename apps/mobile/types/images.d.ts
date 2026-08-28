// Metro resolves image imports to a numeric asset id (or a URI object on
// web) — TS has no ambient declaration for this out of the box, unlike
// `expo/types`, which never needed to cover it before this project's first
// bundled local image (apps/mobile/assets/brand).
declare module "*.png" {
  const value: number;
  export default value;
}
