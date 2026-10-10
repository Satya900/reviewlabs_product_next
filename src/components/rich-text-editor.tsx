"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BackgroundColor, Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { createClient } from "@/lib/supabase/client";
import { FONT_SIZES, HIGHLIGHT_COLORS, TEXT_COLORS, isAllowedImageSrc } from "@/lib/rich-text";
import { cx } from "@/components/ui";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1600;

// Shrinks photos before upload so pages stay fast on mobile data.
async function compressImage(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  // Keep GIFs as they are so animation survives.
  if (file.type === "image/gif") return { blob: file, ext: "gif", type: file.type };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  return blob ? { blob, ext: "webp", type: "image/webp" } : { blob: file, ext: file.name.split(".").pop() ?? "jpg", type: file.type };
}

// Compresses and uploads an image to the creator's media folder; returns its public URL.
async function uploadDescriptionImage(file: File, creatorId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (JPG, PNG, WebP or GIF).");
  const { blob, ext, type } = await compressImage(file);
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error("That image is over 5 MB even after compressing. Try a smaller one.");
  const path = `${creatorId}/media/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("page-covers").upload(path, blob, { contentType: type, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return supabase.storage.from("page-covers").getPublicUrl(path).data.publicUrl;
}

function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
}

function ToolButton({ active, disabled, onClick, label, children }: { active?: boolean; disabled?: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[14px] transition disabled:opacity-40",
        active ? "bg-primary-soft text-primary" : "text-ink hover:bg-surface-strong",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-6 w-px bg-hairline" aria-hidden />;
}

function Swatches({ colors, onPick, onClear, clearLabel }: { colors: string[]; onPick: (c: string) => void; onClear: () => void; clearLabel: string }) {
  return (
    <div className="absolute left-0 top-11 z-20 w-56 rounded-2xl border border-hairline bg-canvas p-3 shadow-soft">
      <div className="grid grid-cols-8 gap-1.5">
        {colors.map((c) => (
          <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(c)} className="size-6 rounded-full border border-hairline" style={{ background: c }} aria-label={c} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[12px] text-body">
          Custom
          <input type="color" onChange={(e) => onPick(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-hairline bg-canvas" />
        </label>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClear} className="link text-[12px]">{clearLabel}</button>
      </div>
    </div>
  );
}

function Toolbar({ editor, uploading, onPickImage }: { editor: Editor; uploading: boolean; onPickImage: (file: File) => void }) {
  const [menu, setMenu] = useState<"color" | "highlight" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      h4: e.isActive("heading", { level: 4 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      fontSize: (e.getAttributes("textStyle").fontSize as string | undefined) ?? "",
      color: (e.getAttributes("textStyle").color as string | undefined) ?? "",
      align: (["center", "right", "justify"].find((a) => e.isActive({ textAlign: a })) ?? "left") as string,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const block = s.h2 ? "h2" : s.h3 ? "h3" : s.h4 ? "h4" : "p";

  function setBlock(value: string) {
    const chain = editor.chain().focus();
    if (value === "p") chain.setParagraph().run();
    else chain.toggleHeading({ level: Number(value.slice(1)) as 2 | 3 | 4 }).run();
  }

  function setLink() {
    const current = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (https://…)", current ?? "https://");
    if (url === null) return;
    if (url === "" || url === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^(https:\/\/|mailto:)/.test(url) ? url : `https://${url.replace(/^http:\/\//, "")}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-2xl border-b border-hairline bg-canvas/95 p-1.5 backdrop-blur">
      <select value={block} onChange={(e) => setBlock(e.target.value)} aria-label="Text style" className="h-9 rounded-lg bg-surface-soft px-2 text-[13px] font-medium outline-none">
        <option value="p">Paragraph</option>
        <option value="h2">Heading 1</option>
        <option value="h3">Heading 2</option>
        <option value="h4">Heading 3</option>
      </select>
      <select
        value={s.fontSize}
        onChange={(e) => (e.target.value ? editor.chain().focus().setFontSize(e.target.value).run() : editor.chain().focus().unsetFontSize().run())}
        aria-label="Text size"
        className="h-9 rounded-lg bg-surface-soft px-2 text-[13px] font-medium outline-none"
      >
        {FONT_SIZES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      <Divider />
      <ToolButton label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolButton>
      <ToolButton label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><i className="font-serif">I</i></ToolButton>
      <ToolButton label="Underline" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolButton>
      <ToolButton label="Strikethrough" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolButton>
      <div className="relative">
        <ToolButton label="Text colour" active={menu === "color"} onClick={() => setMenu(menu === "color" ? null : "color")}>
          <span className="flex flex-col items-center leading-none">A<span className="mt-0.5 h-1 w-4 rounded-full" style={{ background: s.color || "#0a0b0d" }} /></span>
        </ToolButton>
        {menu === "color" && (
          <Swatches colors={TEXT_COLORS} clearLabel="Default" onPick={(c) => { editor.chain().focus().setColor(c).run(); setMenu(null); }} onClear={() => { editor.chain().focus().unsetColor().run(); setMenu(null); }} />
        )}
      </div>
      <div className="relative">
        <ToolButton label="Highlight" active={menu === "highlight"} onClick={() => setMenu(menu === "highlight" ? null : "highlight")}>
          <span className="rounded bg-[#fff3b0] px-1 text-[13px]">ab</span>
        </ToolButton>
        {menu === "highlight" && (
          <Swatches colors={HIGHLIGHT_COLORS} clearLabel="None" onPick={(c) => { editor.chain().focus().setBackgroundColor(c).run(); setMenu(null); }} onClear={() => { editor.chain().focus().unsetBackgroundColor().run(); setMenu(null); }} />
        )}
      </div>
      <Divider />
      <ToolButton label="Bulleted list" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="4.5" cy="6" r="1.4" fill="currentColor" /><circle cx="4.5" cy="12" r="1.4" fill="currentColor" /><circle cx="4.5" cy="18" r="1.4" fill="currentColor" /></svg>
      </ToolButton>
      <ToolButton label="Numbered list" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path d="M10 6h10M10 12h10M10 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><text x="2" y="8" fontSize="7" fill="currentColor">1</text><text x="2" y="14" fontSize="7" fill="currentColor">2</text><text x="2" y="20" fontSize="7" fill="currentColor">3</text></svg>
      </ToolButton>
      <ToolButton label="Quote" active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <span className="text-[20px] leading-none">&ldquo;</span>
      </ToolButton>
      <Divider />
      {(["left", "center", "right"] as const).map((a) => (
        <ToolButton key={a} label={`Align ${a}`} active={s.align === a} onClick={() => editor.chain().focus().setTextAlign(a).run()}>
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path d={a === "left" ? "M4 6h16M4 10h10M4 14h16M4 18h10" : a === "center" ? "M4 6h16M7 10h10M4 14h16M7 18h10" : "M4 6h16M10 10h10M4 14h16M10 18h10"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </ToolButton>
      ))}
      <Divider />
      <ToolButton label="Link" active={s.link} onClick={setLink}>
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </ToolButton>
      <ToolButton label="Insert image" disabled={uploading} onClick={() => fileRef.current?.click()}>
        {uploading ? <span className="size-4 animate-spin rounded-full border-2 border-surface-strong border-t-primary" /> : (
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="9" cy="10" r="1.6" fill="currentColor" /><path d="m4 17 5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
        )}
      </ToolButton>
      <ToolButton label="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <span className="h-0.5 w-4 rounded bg-current" />
      </ToolButton>
      <Divider />
      <ToolButton label="Undo" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}>↶</ToolButton>
      <ToolButton label="Redo" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}>↷</ToolButton>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPickImage(f);
        }}
      />
    </div>
  );
}

type EditorProps = {
  value: string;
  onChange: (html: string) => void;
  creatorId: string;
  placeholder?: string;
  // Tells the parent when images are still uploading, so it can hold off saving.
  onBusyChange?: (busy: boolean) => void;
};

export function RichTextEditor({ value, onChange, creatorId, placeholder, onBusyChange }: EditorProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const importing = useRef(new Set<string>());

  // Images pasted or dragged in from other websites are copied into the
  // creator's storage by the server, then swapped in place of the original link.
  function importExternalImages(ed: Editor) {
    const found = new Set<string>();
    ed.state.doc.descendants((node) => {
      const src = node.type.name === "image" ? (node.attrs.src as string | undefined) : undefined;
      if (src && /^https?:\/\//.test(src) && !isAllowedImageSrc(src) && !importing.current.has(src)) found.add(src);
    });
    for (const src of found) {
      importing.current.add(src);
      setUploading((n) => n + 1);
      void (async () => {
        let replacement: string | null = null;
        try {
          const res = await fetch("/api/media/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: src }) });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.url) replacement = data.url;
          else setUploadError(data.error ? `One image couldn't be copied: ${data.error}` : "One image couldn't be copied.");
        } catch {
          setUploadError("One image couldn't be copied. Check your connection.");
        } finally {
          replaceImageSrc(ed, src, replacement);
          importing.current.delete(src);
          setUploading((n) => n - 1);
        }
      })();
    }
  }

  // Points every image using `from` at `to`, or removes them if the copy failed.
  function replaceImageSrc(ed: Editor, from: string, to: string | null) {
    if (ed.isDestroyed) return;
    const hits: { pos: number; size: number; attrs: Record<string, unknown> }[] = [];
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === "image" && node.attrs.src === from) hits.push({ pos, size: node.nodeSize, attrs: node.attrs });
    });
    if (!hits.length) return;
    const tr = ed.state.tr;
    for (const hit of hits.reverse()) {
      if (to) tr.setNodeMarkup(hit.pos, undefined, { ...hit.attrs, src: to });
      else tr.delete(hit.pos, hit.pos + hit.size);
    }
    ed.view.dispatch(tr);
  }

  // Uploads image files and inserts them (at the drop point, or at the cursor).
  async function insertImages(files: File[], editorRef: Editor | null, at?: number) {
    if (!editorRef || !files.length) return;
    setUploadError(null);
    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const src = await uploadDescriptionImage(file, creatorId);
        const node = { type: "image", attrs: { src, alt: file.name.replace(/\.[^.]+$/, "") } };
        if (typeof at === "number") editorRef.chain().focus().insertContentAt(at, node).run();
        else editorRef.chain().focus().insertContent(node).run();
      } catch (e) {
        setUploadError((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, protocols: ["https", "mailto"], HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
        codeBlock: false,
        code: false,
      }),
      TextStyle,
      Color,
      BackgroundColor,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Describe what buyers get…" }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "rich-text min-h-[260px] px-4 py-4 outline-none",
      },
      // Pasted image files are uploaded like the image button.
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length) return false;
        event.preventDefault();
        void insertImages(files, editorRef.current);
        return true;
      },
      // Dropped image files are uploaded and placed where they were dropped.
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(files, editorRef.current, pos);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.isEmpty ? "" : e.getHTML());
      importRef.current(e);
    },
  });

  // Lets handlers created once (paste, drop, update) reach the latest values.
  const editorRef = useRef<Editor | null>(null);
  const importRef = useRef(importExternalImages);
  useEffect(() => {
    editorRef.current = editor;
    importRef.current = importExternalImages;
  });

  useEffect(() => {
    onBusyChange?.(uploading > 0);
  }, [uploading, onBusyChange]);

  // Keep the editor in sync if the saved value changes from outside (e.g. after save).
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !(value === "" && editor.isEmpty)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className="rounded-2xl border border-hairline bg-canvas focus-within:border-primary">
      {editor ? (
        <Toolbar editor={editor} uploading={uploading > 0} onPickImage={(f) => void insertImages([f], editor)} />
      ) : (
        <div className="h-12 rounded-t-2xl border-b border-hairline" />
      )}
      <EditorContent editor={editor} />
      {uploading > 0 && <p className="px-4 pb-3 text-[13px] text-muted">Uploading image…</p>}
      {uploadError && <p className="px-4 pb-3 text-[13px] text-down">{uploadError}</p>}

    </div>
  );
}
