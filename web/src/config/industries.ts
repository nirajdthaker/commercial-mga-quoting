// Single source of truth for the industry dropdown. Adding a new industry
// later is just adding an entry here — no other code needs to change to
// make it selectable. Set `enabled: true` once that industry's intake
// flow is actually built.
export interface Industry {
  id: string;
  label: string;
  enabled: boolean;
}

export const INDUSTRIES: Industry[] = [
  { id: "hotel", label: "Hotel", enabled: true },
  { id: "restaurant", label: "Restaurant", enabled: false },
  { id: "retail", label: "Retail / Mercantile", enabled: false },
  { id: "habitational", label: "Habitational / Apartments", enabled: false },
];
