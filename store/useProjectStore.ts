import { create } from "zustand";

export interface FileEntry {
  content: string;
  dirty: boolean;
}

export interface FileMutation {
  op: "write" | "edit" | "delete";
  path: string;
  content?: string;
}

interface ProjectState {
  files: Record<string, FileEntry>;
  order: string[];
  activePath: string | null;
  /** the file the agent is currently writing/editing — FileTree pulses its dot; null when idle */
  workingPath: string | null;
  setInitial: (files: { path: string; content: string }[]) => void;
  applyMutation: (m: FileMutation) => void;
  setActive: (path: string) => void;
  setWorking: (path: string | null) => void;
  updateActiveContent: (content: string) => void;
}

/**
 * Single source of truth for the editor. The agent loop echoes file_mutation events over SSE
 * (ChatPanel) → applyMutation → Monaco + FileTree + Preview re-render (one-way, no drift).
 */
export const useProjectStore = create<ProjectState>((set) => ({
  files: {},
  order: [],
  activePath: null,
  workingPath: null,

  setInitial: (list) =>
    set(() => {
      const files: Record<string, FileEntry> = {};
      const order: string[] = [];
      for (const f of list) {
        files[f.path] = { content: f.content, dirty: false };
        order.push(f.path);
      }
      return { files, order, activePath: order[0] ?? null };
    }),

  applyMutation: (m) =>
    set((s) => {
      if (m.op === "delete") {
        const files = { ...s.files };
        delete files[m.path];
        const order = s.order.filter((p) => p !== m.path);
        return {
          files,
          order,
          activePath: s.activePath === m.path ? order[0] ?? null : s.activePath,
          workingPath: s.workingPath === m.path ? null : s.workingPath,
        };
      }
      const files = { ...s.files, [m.path]: { content: m.content ?? "", dirty: false } };
      const order = s.order.includes(m.path) ? s.order : [...s.order, m.path];
      // jump to + mark as the file being written (FileTree pulses its dot)
      return { files, order, activePath: m.path, workingPath: m.path };
    }),

  setActive: (path) => set({ activePath: path }),
  setWorking: (path) => set({ workingPath: path }),

  updateActiveContent: (content) =>
    set((s) =>
      s.activePath
        ? { files: { ...s.files, [s.activePath]: { content, dirty: true } } }
        : {},
    ),
}));
