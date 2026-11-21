/** Every `size`-element subsequence of `items`, in `itertools.combinations` order. */
export function combinations<T>(
  items: ReadonlyArray<T>,
  size: number
): Array<ReadonlyArray<T>> {
  if (size === 0) {
    return [[]];
  }
  return items.flatMap((item, index) =>
    combinations(items.slice(index + 1), size - 1).map((rest) => [
      item,
      ...rest,
    ])
  );
}
