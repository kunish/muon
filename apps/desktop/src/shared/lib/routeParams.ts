import type { RouteLocationNormalizedLoaded } from 'vue-router'

/**
 * Read an optional path param from a route as a plain string.
 *
 * Typed file-based routing makes `route.params` a union across every generated
 * route, so a component shared by several routes (e.g. ChatPage serving `/dm`,
 * `/dm/:roomId` and the channel route) can't index a param directly. This narrows
 * the union to the practical `string | undefined` shape and flattens repeatable params.
 */
export function routeParam(route: RouteLocationNormalizedLoaded, key: string): string | undefined {
  const value = (route.params as Record<string, string | string[] | undefined>)[key]
  return Array.isArray(value) ? value[0] : value
}
