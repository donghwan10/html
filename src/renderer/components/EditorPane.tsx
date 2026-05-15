import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { FolderOpen, ImagePlus, RotateCcw } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from "react";
import type { InputMode, ResolvedInputMode } from "../../shared/types";
import IconButton from "./IconButton";

export interface EditorPaneHandle {
  insertText: (text: string) => void;
  focus: () => void;
}

interface EditorPaneProps {
  value: string;
  inputMode: InputMode;
  resolvedMode: ResolvedInputMode;
  dark: boolean;
  onChange: (value: string) => void;
  onModeChange: (mode: InputMode) => void;
  onOpenFile: () => void;
  onInsertImage: () => void;
  onClear: () => void;
}

function languageExtension(mode: ResolvedInputMode) {
  return mode === "html" ? html() : markdown();
}

const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(function EditorPane(
  {
    value,
    inputMode,
    resolvedMode,
    dark,
    onChange,
    onModeChange,
    onOpenFile,
    onInsertImage,
    onClear
  },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const languageCompartment = useMemo(() => new Compartment(), []);
  const themeCompartment = useMemo(() => new Compartment(), []);

  onChangeRef.current = onChange;

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        view.dispatch(view.state.replaceSelection(text));
        view.focus();
      },
      focus: () => viewRef.current?.focus()
    }),
    []
  );

  useEffect(() => {
    if (!hostRef.current) {
      return undefined;
    }

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          placeholder("HTML 또는 Markdown을 붙여넣기"),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          keymap.of([
            { key: "Mod-z", run: undo },
            { key: "Mod-y", run: redo },
            { key: "Shift-Mod-z", run: redo },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap
          ]),
          languageCompartment.of(languageExtension(resolvedMode)),
          themeCompartment.of(dark ? oneDark : []),
          EditorView.theme({
            "&": {
              height: "100%",
              fontSize: "14px"
            },
            ".cm-scroller": {
              fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace'
            },
            ".cm-content": {
              padding: "14px 0"
            },
            ".cm-gutters": {
              borderRight: "1px solid var(--border)"
            }
          })
        ]
      })
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: current.length,
          insert: value
        }
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: languageCompartment.reconfigure(languageExtension(resolvedMode))
    });
  }, [languageCompartment, resolvedMode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: themeCompartment.reconfigure(dark ? oneDark : [])
    });
  }, [dark, themeCompartment]);

  return (
    <div className="editor-pane">
      <div className="pane-header">
        <div>
          <h1>입력</h1>
          <p>{resolvedMode.toUpperCase()}</p>
        </div>
        <div className="segmented-control" aria-label="입력 모드">
          {(["auto", "html", "markdown"] as InputMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={inputMode === mode ? "is-active" : ""}
              onClick={() => onModeChange(mode)}
            >
              {mode === "auto" ? "Auto" : mode === "html" ? "HTML" : "Markdown"}
            </button>
          ))}
        </div>
      </div>

      <div className="editor-host" ref={hostRef} />

      <div className="pane-actions">
        <IconButton icon={<FolderOpen size={16} />} label="열기" onClick={onOpenFile} />
        <IconButton icon={<ImagePlus size={16} />} label="이미지" onClick={onInsertImage} />
        <IconButton icon={<RotateCcw size={16} />} label="초기화" variant="danger" onClick={onClear} />
      </div>
    </div>
  );
});

export default EditorPane;
