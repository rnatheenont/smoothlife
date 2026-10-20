import { test } from "node:test";
import assert from "node:assert/strict";
import { headlineRating } from "./product-rating.ts";

const judgeMe = { rating: 4.8, reviewCount: 342 };

// The case this function exists for: the page, the card and the Shopify
// storefront must all say 4.8 from 342, including when somebody has left two
// five-star reviews on this site.
test("the store's score wins over a handful of reviews written here", () => {
  assert.deepEqual(headlineRating(judgeMe, [{ rating: 5 }, { rating: 5 }]), {
    value: 4.8,
    count: 342,
  });
});

test("the store's score is used when this site has no reviews", () => {
  assert.deepEqual(headlineRating(judgeMe, []), { value: 4.8, count: 342 });
});

test("our own reviews are the rating when the store has none", () => {
  assert.deepEqual(headlineRating({ rating: 0, reviewCount: 0 }, [{ rating: 5 }, { rating: 4 }]), {
    value: 4.5,
    count: 2,
  });
});

test("no reviews anywhere means no rating, not a zero", () => {
  assert.equal(headlineRating({ rating: 0, reviewCount: 0 }, []), null);
  assert.equal(headlineRating({}, []), null);
  assert.equal(headlineRating({ rating: null, reviewCount: null }, []), null);
});

// A count with no value, or a value with no count, is a half-written
// metafield rather than a rating — Google rejects either on its own.
test("a half-filled store score falls through to our own reviews", () => {
  assert.deepEqual(headlineRating({ rating: 4.5, reviewCount: 0 }, [{ rating: 3 }]), {
    value: 3,
    count: 1,
  });
  assert.deepEqual(headlineRating({ rating: 0, reviewCount: 12 }, [{ rating: 3 }]), {
    value: 3,
    count: 1,
  });
});

test("an average is rounded to one decimal, as the stars are drawn", () => {
  const r = headlineRating({ rating: 0, reviewCount: 0 }, [{ rating: 5 }, { rating: 4 }, { rating: 4 }]);
  assert.deepEqual(r, { value: 4.3, count: 3 });
});
