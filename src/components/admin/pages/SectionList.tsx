"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Lock, Trash2 } from "lucide-react";
import type { SectionInstance } from "@/lib/pages/doc";

// The list of what a page is made of, in the order it is made of it.
//
// Dragging is the only way to reorder now; the up/down buttons are gone. That
// is safe because the handle itself is keyboard-operable — Tab to it, Space
// to pick the section up, arrows to move it, Space to drop — so nothing has
// been taken away from anyone who cannot use a pointer. It did cost four
// buttons' worth of width in a rail where the section names were the thing
// being squeezed.
//
// The handle is its own control rather than the whole row, because the row is
// a button: making all of it draggable means every attempt to select a
// section starts a drag that has to be cancelled.

type Entry = {
  type: string;
  label: string;
  /** Part of the shop rather than part of the copy: no delete, no hide. */
  locked?: boolean;
  /** Welded to the head or the foot of the page: drawn outside the sortable
   *  list, so there is no drag to refuse rather than a card that springs
   *  back, which reads as a bug. */
  pinned?: "top" | "bottom" | null;
};

export default function SectionList({
  sections,
  byType,
  selected,
  onSelect,
  onReorder,
  onToggleHidden,
  onRemove,
}: {
  sections: SectionInstance[];
  byType: Map<string, Entry>;
  selected: string | null;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onToggleHidden: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(
    // A few pixels before a press becomes a drag: without it, a click that
    // moves by one pixel — which is most clicks — is swallowed as a drag and
    // the section never gets selected.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Three lists, one order. The pinned ones are drawn as plain rows; only
  // the middle is sortable. Indexes handed to onReorder are still positions
  // in the whole page, because that is what the document is.
  const pinOf = (s: SectionInstance) => byType.get(s.type)?.pinned ?? null;
  const pinnedTop = sections.filter((s) => pinOf(s) === "top");
  const pinnedBottom = sections.filter((s) => pinOf(s) === "bottom");
  const movable = sections.filter((s) => !pinOf(s));

  function row(section: SectionInstance) {
    const entry = byType.get(section.type);
    return (
      <Row
        key={section.id}
        section={section}
        label={entry?.label ?? section.type}
        known={Boolean(entry)}
        locked={Boolean(entry?.locked)}
        pinned={entry?.pinned ?? null}
        active={section.id === selected}
        onSelect={() => onSelect(section.id)}
        onToggleHidden={() => onToggleHidden(section.id)}
        onRemove={() => onRemove(section.id)}
      />
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      // Vertical only and inside the list: a section can be above or below
      // another one and nothing else, so sideways travel is noise, and a card
      // dragged out of its own panel is a card nobody can drop.
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <ol className="p-2">
        {pinnedTop.map(row)}
        <SortableContext items={movable.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {movable.map(row)}
        </SortableContext>
        {pinnedBottom.map(row)}
      </ol>
    </DndContext>
  );
}

function Row({
  section,
  label,
  known,
  locked,
  pinned,
  active,
  onSelect,
  onToggleHidden,
  onRemove,
}: {
  section: SectionInstance;
  label: string;
  known: boolean;
  locked: boolean;
  pinned: "top" | "bottom" | null;
  active: boolean;
  onSelect: () => void;
  onToggleHidden: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: Boolean(pinned),
  });
  const hidden = Boolean(section.common?.hidden);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-90" : undefined}
    >
      <div
        className={`flex items-center gap-1 rounded-lg px-1 py-1.5 ${
          active ? "bg-brand-gradient-soft" : "hover:bg-surface-soft"
        } ${isDragging ? "bg-white shadow-card" : ""}`}
      >
        {pinned ? (
          // Where it sits is not a choice, so there is no handle to offer.
          <span
            title={pinned === "top" ? "อยู่บนสุดเสมอ" : "อยู่ล่างสุดเสมอ"}
            className="grid h-8 w-6 shrink-0 place-items-center text-slate-300"
          >
            <Lock size={13} />
          </span>
        ) : (
          <button
            {...attributes}
            {...listeners}
            aria-label={`ลากเพื่อย้าย ${label}`}
            className="grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-slate-300 hover:text-brand-800 active:cursor-grabbing"
          >
            <GripVertical size={15} />
          </button>
        )}
        <button
          onClick={onSelect}
          className="flex min-h-9 min-w-0 flex-1 flex-col justify-center text-left"
          aria-current={active ? "true" : undefined}
        >
          <span
            title={label}
            className={`line-clamp-2 text-[13px] font-semibold ${hidden ? "text-slate-500 line-through" : "text-brand-ink"}`}
          >
            {label}
          </span>
          {!known && <span className="block text-[11px] text-rose-600">ไม่รู้จัก section ชนิดนี้</span>}
        </button>
        {locked ? (
          // No disabled buttons: a control that is visible and does nothing
          // invites the press that teaches somebody the editor is broken.
          // One mark that says why instead.
          <span
            title="ส่วนของระบบ — ซ่อนหรือลบไม่ได้ แต่ย้ายตำแหน่งได้"
            className="grid h-8 w-8 shrink-0 place-items-center text-slate-400"
          >
            <Lock size={14} />
          </span>
        ) : (
          <>
            <button
              onClick={onToggleHidden}
              aria-label={hidden ? `แสดง ${label}` : `ซ่อน ${label}`}
              aria-pressed={hidden}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-800"
            >
              {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              onClick={onRemove}
              aria-label={`ลบ ${label}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-600"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
