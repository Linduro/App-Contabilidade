import type { AppDatabase } from "./setup.js"
import { getDb } from "./setup.js"

export { initDatabase, closeDb, getDb } from "./setup.js"

/** Proxy para módulos que importam `db` após `initDatabase()`. */
export const db = new Proxy({} as AppDatabase, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver)
  },
})
