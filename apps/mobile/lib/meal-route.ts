export function mealRoute(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { pathname: "/(app)/meal/[id]" as any, params: { id } };
}
