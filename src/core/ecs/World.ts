/**
 * ECS-lite (ARCHITECTURE §6): entity = number, components = plain data objects stored per type,
 * systems are plain functions over `world.query(...)`.
 * Entity ids are never reused, so a stale id can't silently point to a new entity.
 */
export type Entity = number;

/** Typed component key. Create one per component with `defineComponent`. */
export interface ComponentType<T> {
  /** Unique per defineComponent call; used for query cache keys. */
  readonly id: number;
  readonly name: string;
  /** Phantom field that carries the data type; never set at runtime. */
  readonly __data?: T;
}

let nextComponentId = 1;

export function defineComponent<T>(name: string): ComponentType<T> {
  return { id: nextComponentId++, name };
}

type AnyComponent = ComponentType<unknown>;

export class World {
  private nextId = 1;
  private readonly alive = new Set<Entity>();
  private readonly stores = new Map<AnyComponent, Map<Entity, unknown>>();
  private readonly queryCache = new Map<string, { version: number; result: Entity[] }>();
  /** Bumped on every structural change (spawn/destroy/add/remove) to invalidate cached queries. */
  private version = 0;

  create(): Entity {
    const entity = this.nextId++;
    this.alive.add(entity);
    this.version++;
    return entity;
  }

  destroy(entity: Entity): void {
    if (!this.alive.delete(entity)) return;
    for (const store of this.stores.values()) store.delete(entity);
    this.version++;
  }

  isAlive(entity: Entity): boolean {
    return this.alive.has(entity);
  }

  get entityCount(): number {
    return this.alive.size;
  }

  /** Adds (or replaces) a component. Returns the stored data object. */
  add<T>(entity: Entity, type: ComponentType<T>, data: T): T {
    if (!this.alive.has(entity)) throw new Error(`World.add: entity ${entity} is not alive`);
    const store = this.storeOf(type);
    if (!store.has(entity)) this.version++;
    store.set(entity, data);
    return data;
  }

  remove<T>(entity: Entity, type: ComponentType<T>): void {
    if (this.stores.get(type as AnyComponent)?.delete(entity)) this.version++;
  }

  has<T>(entity: Entity, type: ComponentType<T>): boolean {
    return this.stores.get(type as AnyComponent)?.has(entity) ?? false;
  }

  get<T>(entity: Entity, type: ComponentType<T>): T | undefined {
    return this.stores.get(type as AnyComponent)?.get(entity) as T | undefined;
  }

  /** Like `get`, but throws when the component is missing. */
  require<T>(entity: Entity, type: ComponentType<T>): T {
    const data = this.get(entity, type);
    if (data === undefined) throw new Error(`World.require: entity ${entity} has no ${type.name}`);
    return data;
  }

  /**
   * Entities having all the given components, in creation order.
   * The returned array is cached until the next structural change — do not mutate it,
   * and do not add/remove components while iterating it.
   */
  query(...types: AnyComponent[]): readonly Entity[] {
    if (types.length === 0) throw new Error('World.query: at least one component type is required');
    let key = '';
    for (const t of types) key += `${t.id},`;
    const cached = this.queryCache.get(key);
    if (cached && cached.version === this.version) return cached.result;

    const stores: Map<Entity, unknown>[] = [];
    for (const t of types) {
      const store = this.stores.get(t);
      if (store) stores.push(store);
    }
    const result: Entity[] = [];
    if (stores.length === types.length) {
      // Iterate the smallest store; check the rest.
      stores.sort((a, b) => a.size - b.size);
      const [smallest, ...rest] = stores as [Map<Entity, unknown>, ...Map<Entity, unknown>[]];
      for (const entity of smallest.keys()) {
        if (rest.every((s) => s.has(entity))) result.push(entity);
      }
      result.sort((a, b) => a - b);
    }
    this.queryCache.set(key, { version: this.version, result });
    return result;
  }

  private storeOf(type: AnyComponent): Map<Entity, unknown> {
    let store = this.stores.get(type);
    if (!store) {
      store = new Map();
      this.stores.set(type, store);
    }
    return store;
  }
}
