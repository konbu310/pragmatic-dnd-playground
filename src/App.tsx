import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useCallback, useState, type FC, type RefCallback } from "react";
import invariant from "tiny-invariant";
import "./App.css";

// ---- Types ----

type Item = { id: string; label: string };

type ColumnsState = Record<string, Item[]>;

type DragData = {
  type: "item";
  itemId: string;
  fromContainerId: string;
};

type DropInfo = {
  id: string;
  from: string;
  to: string;
  beforeId: string | "last";
};

// ---- Utilities ----

function moveItem(state: ColumnsState, args: DropInfo): ColumnsState {
  const next: ColumnsState = Object.fromEntries(
    Object.entries(state).map(([k, v]) => [k, [...v]])
  );
  const source = next[args.from];
  const to = next[args.to];
  const idx = source.findIndex((i) => i.id === args.id);
  invariant(idx !== -1, "Item to move must exist in the source container");
  const [item] = source.splice(idx, 1);
  if (args.beforeId === "last") {
    to.push(item);
  } else {
    let beforeIndex = to.findIndex((i) => i.id === args.beforeId);
    const insertIndex =
      beforeIndex === -1
        ? to.length
        : args.from === args.to && idx <= beforeIndex
          ? beforeIndex + 1
          : beforeIndex;
    to.splice(insertIndex, 0, item);
  }
  return next;
}

function hasDropIntent(children: HTMLCollection): boolean {
  for (const c of children) {
    if (c instanceof HTMLElement && c.hasAttribute("data-drop-intent")) {
      return true;
    }
  }
  return false;
}

// ---- Item component ----

const DraggableItem: FC<{
  item: Item;
  containerId: string;
  onMove: (args: DropInfo) => void;
}> = ({ item, containerId, onMove }) => {
  const setDndAttributes = useCallback<RefCallback<HTMLDivElement>>(
    (el) => {
      invariant(el);
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
    },
    [item.id, containerId, onMove]
  );

  return (
    <div ref={setDndAttributes} role="listitem" className="item">
      {item.id}. {item.label}
    </div>
  );
};

// ---- Column component ----

const Column: FC<{
  id: string;
  title: string;
  items: Item[];
  onMove: (args: DropInfo) => void;
}> = ({ id, title, items, onMove }) => {
  const setDndAttributes = useCallback<RefCallback<HTMLElement>>(
    (el) => {
      invariant(el);
      return dropTargetForElements({
        element: el,
        getData: () => ({ type: "column", containerId: id }),
        canDrop: ({ source, element }) => {
          return (
            source.data?.type === "item" && !hasDropIntent(element.children)
          );
        },
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
            beforeId: "last",
          });
        },
      });
    },
    [id, onMove]
  );

  return (
    <section className="column">
      <header>{title}</header>
      <div ref={setDndAttributes} role="list" className="item-list">
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

  const onMove = useCallback((args: DropInfo) => {
    setColumns((prev) => moveItem(prev, args));
  }, []);

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
