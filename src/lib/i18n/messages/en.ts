import type { Messages } from "./th";

// English. Typed as Messages, so this file cannot be missing a key, cannot
// invent one, and cannot answer a function message with a plain string.
//
// "วัน" is "day" or "days" depending on the number, which is the whole reason
// the spoken messages are functions: Thai has one form and English has two,
// and that difference belongs in the language's own file rather than in the
// component that happens to draw a clock.

export const en: Messages = {
  countdown: {
    label: "Countdown",
    day: "days",
    hour: "hrs",
    minute: "min",
    second: "sec",
    startsIn: "Starts in",
    timeLeft: "Time left",
    spokenDays: (d: number, h: number) =>
      `${d} ${d === 1 ? "day" : "days"} ${h} ${h === 1 ? "hour" : "hours"} left`,
    spokenHours: (h: number, m: number) =>
      `${h} ${h === 1 ? "hour" : "hours"} ${m} ${m === 1 ? "minute" : "minutes"} left`,
    spokenMinutes: (m: number) => `${m} ${m === 1 ? "minute" : "minutes"} left`,
    spokenSoon: "Less than a minute left",
  },
  legal: {
    updated: "Last updated",
    contents: "Contents",
  },
};
