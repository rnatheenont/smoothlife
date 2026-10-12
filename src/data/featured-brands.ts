// The brands the home page leads with, in order.
//
// Its own file, not a const inside BrandCircleRow, because both sides need
// it: the row draws these circles, and the server picks the shelves that go
// under them. A "use client" module's exports are client references on the
// server — importing the list from there gave the build `a is not iterable`
// rather than an array.
export const FEATURED_BRANDS = [
  "smooth-e",
  "dentiste",
  "janeke",
  "eucerin",
  "cerave",
  "blackmores",
  "mega",
  "swisse",
  "vichy",
];
