import DOMPurify from "dompurify";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import clsx from "clsx";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Table as TableIcon,
  Heading1,
  Heading2,
  Minus,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from "lucide-react";

function ToolBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={clsx(
        "rounded-sm p-1 text-sm transition-colors",
        active ? "bg-sapphire-100 text-sapphire-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        disabled && "opacity-30 pointer-events-none",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-slate-200" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  }

  function insertTable() {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5 rounded-t-md">
      <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolBtn>
      <Divider />
      <ToolBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolBtn>
      <Divider />
      <ToolBtn title="Link" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon className="h-4 w-4" />
      </ToolBtn>
      <Divider />
      <ToolBtn title="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolBtn>
      <Divider />
      <ToolBtn title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" />
      </ToolBtn>
      <Divider />
      <ToolBtn title="Table" onClick={insertTable}>
        <TableIcon className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" />
      </ToolBtn>
      <Divider />
      <label title="Text color" className="relative cursor-pointer rounded-sm p-1 hover:bg-slate-100">
        <Palette className="h-4 w-4 text-slate-600" />
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
        />
      </label>
      <Divider />
      <ToolBtn title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="h-4 w-4" />
      </ToolBtn>
    </div>
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write here...",
  disabled = false,
  minHeight = "120px",
}: Props) {
  const editor = useEditor({
    extensions: [
      // StarterKit 3 bundles Link and Underline; turn those off so the ones
      // configured below are the only instances.
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  if (editor && value !== editor.getHTML() && !editor.isFocused) {
    editor.commands.setContent(value || "");
  }

  return (
    <div
      className={clsx(
        "rounded-md border border-sapphire-300 shadow-xs focus-within:border-sapphire-500 focus-within:ring-2 focus-within:ring-sapphire-300 focus-within:ring-offset-0",
        disabled && "opacity-50",
      )}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none markdown-editor-content"
        style={{ minHeight }}
      />
    </div>
  );
}

// Rich text can enter the DB from several places (manual editing, JSON import,
// CSV import, LinkedIn import) — sanitizing here, at the single render choke
// point, covers all of them at once rather than chasing every write site.
// Only what the editor itself produces is allowed, so imported HTML can't bring
// forms, inputs or full-window styles that imitate the app.
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "span", "mark",
    "table", "colgroup", "col", "thead", "tbody", "tr", "th", "td",
  ],
  ALLOWED_ATTR: ["href", "style", "colspan", "rowspan", "colwidth"],
};

// Of inline styles, keep only what the editor sets: text colour and alignment.
const ALLOWED_STYLES = ["color", "text-align"];

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (!(node instanceof HTMLElement)) return;
  if (node.hasAttribute("style")) {
    const kept = ALLOWED_STYLES.map((prop) => [prop, node.style.getPropertyValue(prop)])
      .filter(([, value]) => value)
      .map(([prop, value]) => `${prop}: ${value}`)
      .join("; ");
    if (kept) node.setAttribute("style", kept);
    else node.removeAttribute("style");
  }
  // No target: a clicked link is a navigation, which the navigation guard
  // (src-tauri/src/navigation.rs) sends to the system browser.
  if (node.tagName === "A") node.setAttribute("rel", "noopener noreferrer");
});

export function MarkdownContent({ html }: { html?: string | null }) {
  if (!html) return <span className="text-slate-400">-</span>;
  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, SANITIZE_CONFIG) }}
    />
  );
}
