/**
 * Our own types for Editor.js and its two tools.
 *
 * The packages ship `.ts` type *sources* that use `enum`, which this project
 * forbids with `erasableSyntaxOnly` - plain `node` runs its `.ts` files by
 * stripping types, and `db/migrate.ts` and `scripts/create-admin.ts` import from
 * `app/`. `skipLibCheck` does not help: it skips `.d.ts`, not `.ts`.
 *
 * So `tsconfig.vite.json` maps the three packages here. This describes only the
 * surface `editor.client.tsx` uses. **On an upgrade, check it against the
 * package's own types** - nothing else will notice if they drift.
 */
declare module "@editorjs/editorjs" {
  export interface OutputBlockData {
    id?: string;
    type: string;
    data: unknown;
  }

  export interface OutputData {
    time?: number;
    version?: string;
    blocks: OutputBlockData[];
  }

  export interface EditorConfig {
    holder: HTMLElement | string;
    placeholder?: string;
    inlineToolbar?: boolean | string[];
    tools?: Record<string, unknown>;
    data?: OutputData;
    onChange?: () => void;
    readOnly?: boolean;
  }

  export default class EditorJS {
    constructor(config: EditorConfig);
    readonly isReady: Promise<void>;
    save(): Promise<OutputData>;
    destroy(): void;
  }
}

declare module "@editorjs/header" {
  const Header: unknown;
  export default Header;
}

declare module "@editorjs/list" {
  const List: unknown;
  export default List;
}
