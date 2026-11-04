function toTimestamp_(value) {
  if (value && typeof value.getTime === 'function') return value.getTime();
  return value;
}