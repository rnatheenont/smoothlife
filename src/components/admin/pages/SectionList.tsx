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
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import type { SectionInstance } from "@/lib/pages/doc";

// The list of what a page is made of, in the order it is made of it.
//
// Dragging and the arrow buttons both stay. They are not redundant: a drag is
// the fast way to move something six places, and the arrows are the only way
// to do it from a keyboard without learning a key sequence, on a touch screen
// where a long-press scroll fights the drag, and when the list is taller than
// the window. dnd-kit's keyboard sensor covers the first of those properly —
// space to pick up, arrows to move, space to drop — and the buttons cover the
// rest.
//
// The handle is its own control rather than the whole row, because the row is
// a button: making all of it draggable means every attempt to select a
// section starts a drag that has to be cancelled.

type Entry = { type: string; label: string };

export default function SectionList({
  sections,
  byType,
  selected,
  onSelect,
  onReorder,
  onMove,
  onToggleHidden,
  onRemove,
}: {
  sections: SectionInstance[];
  byType: Map<string, Entry>;
  selected: string | null;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onMove: (id: string, delta: number) => void;
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
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol className="p-2">
          {sections.map((section, i) => (
            <Row
              key={section.id}
              section={section}
              label={byType.get(section.type)?.label ?? section.type}
              known={byType.has(section.type)}
              active={section.id === selected}
              first={i === 0}
              last={i === sections.length - 1}
              onSelect={() => onSelect(section.id)}
              onUp={() => onMove(section.id, -1)}
              onDown={() => onMove(section.id, 1)}
              onToggleHidden={() => onToggleHidden(section.id)}
              onRemove={() => onRemove(section.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function Row({
  section,
  label,
  known,
  active,
  first,
  last,
  onSelect,
  onUp,
  onDown,
  onToggleHidden,
  onRemove,
}: {
  section: SectionInstance;
  label: string;
  known: boolean;
  active: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onUp: () => void;
  onDown: () => void;
  onToggleHidden: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
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
        <button
          {...attributes}
          {...listeners}
          aria-label={`ลากเพื่อย้าย ${label}`}
          className="grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-slate-300 hover:text-brand-800 active:cursor-grabbing"
        >
          <GripVertical size={15} />
        </button>
        <button
          onClick={onSelect}
          className="flex min-h-9 min-w-0 flex-1 flex-col justify-center text-left"
          aria-current={active ? "true" : undefined}
        >
          <span
            title={label}
            className={`line-clamp-2 text-[13px] font-semibold ${hidden ? "text-slate-400 line-through" : "text-brand-ink"}`}
          >
            {label}
          </span>
          {!known && <span className="block text-[11px] text-rose-600">ไม่รู้จัก section ชนิดนี้</span>}
        </button>
        <button
          onClick={onUp}
          disabled={first}
          aria-label={`ย้าย ${label} ขึ้น`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-800 disabled:opacity-30"
        >
          <ArrowUp size={15} />
        </button>
        <button
          onClick={onDown}
          disabled={last}
          aria-label={`ย้าย ${label} ลง`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-800 disabled:opacity-30"
        >
          <ArrowDown size={15} />
        </button>
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
      </div>
    </li>
  );
}
