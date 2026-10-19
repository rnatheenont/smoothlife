"use client";

import { InputOTP, REGEXP_ONLY_DIGITS } from "@heroui/react";

// The six-digit code, as six boxes.
//
// It used to be one pill-shaped text input with letter-spacing and a
// placeholder reading "กรอกรหัสยืนยัน 6 หลัก" — a field that looks like
// every other field on the form, where the only thing saying how many digits
// are wanted is the sentence inside it, which disappears the moment somebody
// types. Six boxes say it without words, show progress while typing, and are
// what every bank and marketplace in this country has trained people to
// expect.
//
// HeroUI's InputOTP underneath (one real <input> behind the boxes), so the
// keyboard, paste, autofill of an SMS code and the caret all behave the way
// the platform's own do — the parts that get quietly lost when six separate
// inputs are wired together by hand.

const SIZE = 6;

/** Taller than HeroUI's 40px default: the row is one tap target the width of
 *  the form, and 48px is the height the rest of this site's fields use. */
const SLOT = "h-12 text-base";

export default function OtpField({
  value,
  onChange,
  onComplete,
  isInvalid = false,
  isDisabled = false,
  ariaLabel = "รหัสยืนยัน 6 หลัก",
}: {
  value: string;
  onChange: (value: string) => void;
  /** Called with the full code the moment the sixth digit lands. */
  onComplete?: (value: string) => void;
  isInvalid?: boolean;
  isDisabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <InputOTP
      maxLength={SIZE}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      pattern={REGEXP_ONLY_DIGITS}
      isInvalid={isInvalid}
      isDisabled={isDisabled}
      autoFocus
      // The one that makes a phone offer the SMS code above the keyboard.
      autoComplete="one-time-code"
      inputMode="numeric"
      aria-label={ariaLabel}
      className="justify-center"
    >
      {/* Three and three: six boxes in a row is a number to count, two
          groups of three is a number to read. */}
      <InputOTP.Group>
        {[0, 1, 2].map((i) => (
          <InputOTP.Slot key={i} index={i} className={SLOT} />
        ))}
      </InputOTP.Group>
      <InputOTP.Separator />
      <InputOTP.Group>
        {[3, 4, 5].map((i) => (
          <InputOTP.Slot key={i} index={i} className={SLOT} />
        ))}
      </InputOTP.Group>
    </InputOTP>
  );
}
