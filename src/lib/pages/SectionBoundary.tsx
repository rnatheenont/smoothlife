"use client";

import { Component, type ReactNode } from "react";

// The client half of the safety net.
//
// renderSections catches what a section throws while the server builds it.
// This catches what it throws afterwards, in the browser — a carousel that
// divides by a length of zero, an effect that reads a property off something
// the API did not return. Without it, React unmounts the entire route and the
// customer gets a blank screen because one shelf had a bad day.
//
// A class component because that is still the only way to catch a render
// error in React; there is no hook for it.

type Props = { id: string; label: string; isPreview: boolean; children: ReactNode };
type State = { failed: boolean; message: string | null };

export default class SectionBoundary extends Component<Props, State> {
  state: State = { failed: false, message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    console.error(`[pages] section ${this.props.id} (${this.props.label}) failed in the browser`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    // On the live site the section simply is not there. Someone editing the
    // page is told, because a section that vanishes while you are working on
    // it is a bug nobody can report.
    if (!this.props.isPreview) return null;

    return (
      <div className="container-page my-4">
        <div className="rounded-xl2 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">section นี้มีปัญหา จึงไม่ถูกแสดงบนหน้าจริง</p>
          <p className="mt-1">{this.props.label}</p>
          {this.state.message && <p className="mt-1 font-mono text-[12px] opacity-80">{this.state.message}</p>}
        </div>
      </div>
    );
  }
}
