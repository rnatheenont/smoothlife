// Who wins the Lucky Fan prizes, and in what order they are drawn.
//
// Not the same rule as the weighted draw in the receipts console, and
// deliberately kept apart from it. That one puts every entry in one bag and
// pulls 25 names out, which lets a run of luck hand the whole thing to people
// with two receipts each while the customer who sent in thirty-six gets
// nothing. This one splits the room by how much somebody actually entered:
//
//   - 10 entries and up  — everybody in this band wins. Eight people, and
//     between them 153 of the 726 entries; there is no sense in making them
//     draw for it.
//   - 6 to 9 entries     — twelve of them, drawn.
//   - 1 to 5 entries     — five, drawn, so the prize is not closed to
//     somebody who sent in one receipt.
//
// Pure, and the randomness is handed in, so the rule can be tested by running
// it rather than by reading it.

export const LUCKY_FAN_PRIZES = 25;

export type Entrant = { userId: string; name: string | null; entries: number };

export type BandKey = "gold" | "silver" | "open";

export type Band = {
  key: BandKey;
  label: string;
  /** How the screen says who is in it. */
  range: string;
  min: number;
  max: number;
  /** null = everybody in the band wins, as far as the prizes go round. */
  seats: number | null;
};

export const BANDS: Band[] = [
  { key: "gold", label: "แฟนตัวจริง", range: "10 สิทธิ์ขึ้นไป", min: 10, max: Infinity, seats: null },
  { key: "silver", label: "แฟนตัวยง", range: "6–9 สิทธิ์", min: 6, max: 9, seats: 12 },
  { key: "open", label: "สายเปย์หน้าใหม่", range: "1–5 สิทธิ์", min: 1, max: 5, seats: 5 },
];

export type Winner = {
  userId: string;
  name: string | null;
  entries: number;
  band: BandKey;
  /** 1-based, the order the names come out of the machine. */
  order: number;
};

/** 0 ≤ rng() < 1. Handed in so a test can make the draw repeat itself. */
export type Rng = () => number;

export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
};

// Every function below takes the bands as an argument with BANDS as the
// default. The rehearsal screen lets somebody move the thresholds and the
// seats and watch what it does to the result, which is the whole reason to
// have a rehearsal screen — and a rule that can only be changed by editing
// this file is a rule nobody can argue with before the night.
export function bandOf(entries: number, bands: Band[] = BANDS): BandKey | null {
  const band = bands.find((b) => entries >= b.min && entries <= b.max);
  return band?.key ?? null;
}

export function splitIntoBands(pool: Entrant[], bands: Band[] = BANDS): Record<BandKey, Entrant[]> {
  const out: Record<BandKey, Entrant[]> = { gold: [], silver: [], open: [] };
  for (const e of pool) {
    const key = bandOf(e.entries, bands);
    if (key) out[key].push(e);
  }
  return out;
}

/**
 * Take `n` from one band, weighted by entries, without replacement.
 *
 * Weighted inside the band as well as between them: six entries against nine
 * is a real difference, and flattening it would mean the band boundary is the
 * only thing that counts. All of somebody's tickets leave the bag once they
 * win, because the prize is per person — leaving them in would mean drawing
 * the same name again and skipping it, which lowers everyone else's odds by
 * a different amount depending on how many tickets the winner was holding.
 */
export function drawFromBand(band: Entrant[], n: number, rng: Rng): Entrant[] {
  const bag = [...band];
  const picked: Entrant[] = [];
  while (picked.length < n && bag.length > 0) {
    const total = bag.reduce((sum, e) => sum + Math.max(1, e.entries), 0);
    let ticket = rng() * total;
    let index = bag.length - 1;
    for (let i = 0; i < bag.length; i++) {
      ticket -= Math.max(1, bag[i].entries);
      if (ticket < 0) {
        index = i;
        break;
      }
    }
    picked.push(bag[index]);
    bag.splice(index, 1);
  }
  return picked;
}

/**
 * The whole draw, in the order the machine should reveal it.
 *
 * Seats that a band cannot fill move down to the next one rather than going
 * unawarded — twenty-five prizes were announced, so twenty-five are given as
 * long as there are that many people in the room. The gold band is read
 * first for the same reason it exists: if it ever grew past twenty-five, the
 * prizes would go to the twenty-five of them the draw picks, not to whoever
 * the silver band threw up first.
 */
export function drawLuckyFan(
  pool: Entrant[],
  rng: Rng = cryptoRng,
  prizes = LUCKY_FAN_PRIZES,
  spec: Band[] = BANDS,
): Winner[] {
  const bands = splitIntoBands(pool, spec);
  const winners: Winner[] = [];
  let left = prizes;

  for (const band of spec) {
    if (left <= 0) break;
    const people = bands[band.key];
    // null seats means "everybody", which is still capped by what is left.
    const want = band.seats === null ? people.length : band.seats;
    const take = Math.min(want, left, people.length);
    for (const e of drawFromBand(people, take, rng)) {
      winners.push({ ...e, band: band.key, order: 0 });
    }
    left -= take;
  }

  // Still short — a band ran out and the ones below it did too. Whoever is
  // left over anywhere fills the rest, so the count on the poster is the
  // count that gets handed out.
  if (left > 0) {
    const taken = new Set(winners.map((w) => w.userId));
    const rest = pool.filter((e) => !taken.has(e.userId) && bandOf(e.entries, spec) !== null);
    for (const e of drawFromBand(rest, left, rng)) {
      winners.push({ ...e, band: bandOf(e.entries, spec) ?? "open", order: 0 });
    }
  }

  return winners.map((w, i) => ({ ...w, order: i + 1 }));
}


/** Two more names, called out on the night. */
export const PHONE_IN_PRIZES = 2;

/**
 * Phone in: two more from the band in the middle.
 *
 * The twenty-five are already decided when this runs, and nobody holds two
 * prizes — so the pool is the 6-to-9 band minus whoever is already on the
 * list. Weighted inside the band like every other draw here: six entries
 * against nine is a real difference whichever draw is being run.
 */
export function drawPhoneIn(
  pool: Entrant[],
  alreadyWon: Iterable<string>,
  take = PHONE_IN_PRIZES,
  rng: Rng = cryptoRng,
  spec: Band[] = BANDS,
  from: BandKey = "silver",
): Winner[] {
  const won = new Set(alreadyWon);
  const band = splitIntoBands(pool, spec)[from].filter((e) => !won.has(e.userId));
  return drawFromBand(band, take, rng).map((e, i) => ({
    ...e,
    band: from,
    order: i + 1,
  }));
}

export type GiftSeats = { vip: number; lucky: number };

export const GIFT_EXCHANGE: GiftSeats = { vip: 8, lucky: 2 };

/**
 * Gift exchange: ten names out of the VIP list, in two kinds.
 *
 * One pool, not two. Both halves come from the same twenty-one VIP buyers —
 * eight take the VIP gift and two take the Lucky one — so the only thing
 * that separates them is which gift they are called for. Drawn in one pass
 * without replacement, because the alternative is two draws that can land
 * on the same person and a rule bolted on afterwards to say they cannot.
 *
 * Flat, not weighted. Entries decided who got onto this list in the first
 * place and have no second say here; everybody standing in the room for a
 * gift exchange is standing in it on equal terms. Entries of 1 is what
 * makes drawFromBand uniform.
 */
export function drawGiftExchange(
  vips: Entrant[],
  alreadyWon: Iterable<string> = [],
  seats: GiftSeats = GIFT_EXCHANGE,
  rng: Rng = cryptoRng,
): Winner[] {
  const taken = new Set(alreadyWon);
  const pool = vips.filter((e) => !taken.has(e.userId)).map((e) => ({ ...e, entries: 1 }));
  const picked = drawFromBand(pool, seats.vip + seats.lucky, rng);
  return picked.map((e, i) => ({
    ...e,
    // The first eight out are the VIP gifts, the last two the Lucky ones.
    band: (i < seats.vip ? "gold" : "silver") as BandKey,
    order: i + 1,
  }));
}
