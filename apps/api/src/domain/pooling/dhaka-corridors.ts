export const POOLING_ZONES = [
  "BANANI",
  "GULSHAN_1",
  "GULSHAN_2",
  "MOHAKHALI",
  "DHANMONDI",
  "MIRPUR",
  "UTTARA",
  "FARMGATE",
  "BASHUNDHARA",
] as const;

export type PoolingZone = (typeof POOLING_ZONES)[number];

export const DHAKA_CORRIDORS: readonly (readonly PoolingZone[])[] = [
  ["BANANI", "MOHAKHALI", "GULSHAN_1", "GULSHAN_2"],
  ["MIRPUR", "FARMGATE", "DHANMONDI"],
  ["UTTARA", "BANANI", "BASHUNDHARA"],
];
