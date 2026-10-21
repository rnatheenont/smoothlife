"use client";

import { useEffect, useRef } from "react";
import SmoothieRig, { type SmoothieRigHandle } from "@/components/mascot/SmoothieRig";

// Smoothie in the chat header, acting out what the assistant is doing:
// thinking while the question is with the AI, talking while the answer
// streams in, and a happy beat when it is done. One rig per chat surface —
// the message avatars stay pictures, a WebGL context each would be too many.

export type ChatMood = "idle" | "thinking" | "talking";

export function chatMood(loading: boolean, lastRole: string | undefined): ChatMood {
  if (!loading) return "idle";
  return lastRole === "assistant" ? "talking" : "thinking";
}

export default function ChatMascot({ mood, className }: { mood: ChatMood; className?: string }) {
  const rig = useRef<SmoothieRigHandle>(null);
  const prev = useRef<ChatMood>(mood);

  useEffect(() => {
    const was = prev.current;
    prev.current = mood;
    if (mood === "idle") {
      if (was !== "idle") rig.current?.play("happy");
      return;
    }
    const move = mood === "thinking" ? "think" : "talk";
    rig.current?.play(move);
    // Keep it going for as long as the state lasts; the engine queues a move
    // asked for mid-gesture, so this only starts the next one once it is free.
    const id = setInterval(() => {
      if (rig.current && !rig.current.playing) rig.current.play(move);
    }, 400);
    return () => clearInterval(id);
  }, [mood]);

  return (
    <SmoothieRig
      ref={rig}
      framing="bust"
      className={className}
      greet={null}
      playOnClick={false}
      idleActions={["nod", "happy"]}
      idleEvery={14}
    />
  );
}
