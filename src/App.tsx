import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useEffect, useMemo, useRef, useState, type FC } from "react";
import "./App.css";

// ---- Types ----

type Item = { id: string; label: string };

type ColumnsState = Record<string, Item[]>;

type DragData = {
  type: "item";
  itemId: string;
  fromContainerId: string;
};

// ---- Utilities ----

function moveItem(
  state: ColumnsState,
  args:
    | { id: string; from: string; to: string; beforeId?: string }
    | { id: string; from: string; to: string; toEnd: true }
): ColumnsState {
  const next: ColumnsState = Object.fromEntries(
    Object.entries(state).map(([k, v]) => [k, [...v]])
  );
  const source = next[args.from];
  const to = next[args.to];
  const idx = source.findIndex((i) => i.id === args.id);
  if (idx === -1) return state; // nothing to do
  const [item] = source.splice(idx, 1);

  if ("toEnd" in args && args.toEnd) {
    to.push(item);
  } else if ("beforeId" in args && args.beforeId) {
    const beforeIndex = to.findIndex((i) => i.id === args.beforeId);
    const insertIndex = beforeIndex === -1 ? to.length : beforeIndex;
    to.splice(insertIndex, 0, item);
  }
  return next;
}

// ---- Item component ----

const DraggableItem: FC<{
  item: Item;
  containerId: string;
  onMove: (
    args:
      | { id: string; from: string; to: string; beforeId?: string }
      | { id: string; from: string; to: string; toEnd: true }
  ) => void;
}> = ({ item, containerId, onMove }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const cleanupDraggable = draggable({
      element: el,
      getInitialData: (): DragData => ({
        type: "item",
        itemId: item.id,
        fromContainerId: containerId,
      }),
      onDragStart: () => {
        el.setAttribute("data-dragging", "true");
      },
      onDrop: () => {
        el.removeAttribute("data-dragging");
      },
    });

    // Act as a drop target to insert BEFORE this item
    const cleanupDropTarget = dropTargetForElements({
      element: el,
      getData: () => ({
        type: "item",
        itemId: item.id,
        containerId,
      }),
      canDrop: ({ source }) => source.data?.type === "item",
      onDragEnter: ({ self, source }) => {
        if (source.data?.type !== "item") return;
        (self.element as HTMLElement).setAttribute(
          "data-drop-intent",
          "before"
        );
      },
      onDragLeave: ({ self }) => {
        (self.element as HTMLElement).removeAttribute("data-drop-intent");
      },
      onDrop: ({ self, source }) => {
        (self.element as HTMLElement).removeAttribute("data-drop-intent");
        const data = source.data as DragData | undefined;
        if (!data || data.type !== "item") return;
        onMove({
          id: data.itemId,
          from: data.fromContainerId,
          to: containerId,
          beforeId: item.id,
        });
      },
    });

    return () => combine(cleanupDraggable, cleanupDropTarget)();
  }, [item.id, containerId, onMove]);

  return (
    <div ref={ref} role="listitem" className="item">
      {item.label}
    </div>
  );
};

// ---- Column component ----

const Column: FC<{
  id: string;
  title: string;
  items: Item[];
  onMove: (
    args:
      | { id: string; from: string; to: string; beforeId?: string }
      | { id: string; from: string; to: string; toEnd: true }
  ) => void;
}> = ({ id, title, items, onMove }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Column surface accepts drops to append to END
    const cleanup = dropTargetForElements({
      element: el,
      getData: () => ({ type: "column", containerId: id }),
      canDrop: ({ source }) => source.data?.type === "item",
      onDragEnter: ({ self }) => {
        self.element.setAttribute("data-column-hover", "true");
      },
      onDragLeave: ({ self }) => {
        self.element.removeAttribute("data-column-hover");
      },
      onDrop: ({ self, source }) => {
        self.element.removeAttribute("data-column-hover");
        const data = source.data as DragData | undefined;
        if (!data || data.type !== "item") return;
        onMove({
          id: data.itemId,
          from: data.fromContainerId,
          to: id,
          toEnd: true,
        });
      },
    });

    return () => cleanup();
  }, [id, onMove]);

  return (
    <section className="column">
      <header>{title}</header>
      <div ref={ref} role="list" className="item-list">
        {items.map((it) => (
          <DraggableItem
            key={it.id}
            item={it}
            containerId={id}
            onMove={onMove}
          />
        ))}
      </div>
    </section>
  );
};

// ---- Main Demo ----

export const App: FC = () => {
  const [columns, setColumns] = useState<ColumnsState>(() => ({
    a1: [
      { id: "t1", label: "Write README" },
      { id: "t2", label: "Create wireframes" },
    ],
    a2: [{ id: "d1", label: "Build UI" }],
    a3: [{ id: "d2", label: "Hook up API" }],
    b1: [{ id: "dn1", label: "Project kickoff" }],
    b2: [],
    b3: [],
    c1: [],
    c2: [],
    c3: [],
  }));

  const onMove = useMemo(
    () =>
      (
        args:
          | { id: string; from: string; to: string; beforeId?: string }
          | { id: string; from: string; to: string; toEnd: true }
      ) => {
        setColumns((prev) => moveItem(prev, args));
      },
    []
  );

  const titles: Record<string, string> = {
    a1: "A1",
    a2: "A2",
    a3: "A3",
    b1: "B1",
    b2: "B2",
    b3: "B3",
    c1: "C1",
    c2: "C2",
    c3: "C3",
  };

  return (
    <div className="main-view">
      <div className="column-grid">
        {Object.keys(columns).map((id) => (
          <Column
            key={id}
            id={id}
            title={titles[id]}
            items={columns[id]}
            onMove={onMove}
          />
        ))}
      </div>
    </div>
  );
};
