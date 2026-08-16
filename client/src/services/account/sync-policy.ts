/**
 * 用户数据统一合并规则：集合取并集，同一标识冲突时保留线上对象。
 * 线上数组先进入结果，因此本地同标识项只会被去重，不会覆盖线上字段。
 */
export function mergeCollectionServerFirst<T, Key>(
  localItems: readonly T[],
  serverItems: readonly T[],
  identify: (item: T) => Key
) {
  const merged = new Map<Key, T>()
  for (const item of serverItems) merged.set(identify(item), item)
  for (const item of localItems) {
    const key = identify(item)
    if (!merged.has(key)) merged.set(key, item)
  }
  return [...merged.values()]
}

/** 单值冲突统一使用线上值；仅当线上没有有效值时才使用本地值。 */
export function resolveScalarServerFirst<T>(
  localValue: T | null | undefined,
  serverValue: T | null | undefined,
  isValid: (value: unknown) => value is T
) {
  if (isValid(serverValue)) return { value: serverValue, source: 'server' as const }
  if (isValid(localValue)) return { value: localValue, source: 'local' as const }
  return { value: null, source: 'none' as const }
}
