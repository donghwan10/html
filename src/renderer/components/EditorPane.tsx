import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { FolderOpen, ImagePlus, RotateCcw } from "lucide-react";
import {
  forwardRef,
  type ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from "react";
import type { InputMode, ResolvedInputMode } from "../../shared/types";
import type { PreviewFrameId } from "../lib/previewScroll";
import IconButton from "./IconButton";

export interface EditorPaneHandle {
  insertText: (text: string) => void;
  focus: () => void;
}

interface CodeEditorHandle {
  insertText: (text: string) => void;
  focus: () => void;
  openFind: () => void;
}

interface CodeEditorProps {
  active: boolean;
  dark: boolean;
  placeholderText: string;
  resolvedMode: ResolvedInputMode;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}

interface EditorPaneProps {
  value: string;
  secondaryValue: string;
  activePane: PreviewFrameId;
  doubleMode: boolean;
  inputMode: InputMode;
  resolvedMode: ResolvedInputMode;
  secondaryResolvedMode: ResolvedInputMode;
  dark: boolean;
  onChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  onActivePaneChange: (pane: PreviewFrameId) => void;
  onModeChange: (mode: InputMode) => void;
  onOpenFile: () => void;
  onInsertImage: () => void;
  onClear: () => void;
}

function languageExtension(mode: ResolvedInputMode) {
  return mode === "html" ? html() : markdown();
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { active, dark, placeholderText, resolvedMode, value, onChange, onFocus },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocus);
  const languageCompartment = useMemo(() => new Compartment(), []);
  const themeCompartment = useMemo(() => new Compartment(), []);

  onChangeRef.current = onChange;
  onFocusRef.current = onFocus;

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
      focus: () => viewRef.current?.focus(),
      openFind: () => {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        openSearchPanel(view);
      }
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
          placeholder(placeholderText),
          search({ top: true }),
          highlightSelectionMatches(),
          EditorView.lineWrapping,
          EditorView.domEventHandlers({
            focus: () => {
              onFocusRef.current();
              return false;
            },
            pointerdown: () => {
              onFocusRef.current();
              return false;
            }
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          keymap.of([
            ...searchKeymap,
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

  return <div className={`editor-host ${active ? "editor-host--active" : ""}`} ref={hostRef} />;
});

const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(function EditorPane(
  {
    value,
    secondaryValue,
    activePane,
    doubleMode,
    inputMode,
    resolvedMode,
    secondaryResolvedMode,
    dark,
    onChange,
    onSecondaryChange,
    onActivePaneChange,
    onModeChange,
    onOpenFile,
    onInsertImage,
    onClear
  },
  ref
) {
  const primaryRef = useRef<CodeEditorHandle | null>(null);
  const secondaryRef = useRef<CodeEditorHandle | null>(null);
  const hoveredPaneRef = useRef<PreviewFrameId | null>(null);
  const activePaneRef = useRef(activePane);
  const doubleModeRef = useRef(doubleMode);

  activePaneRef.current = activePane;
  doubleModeRef.current = doubleMode;

  const openActiveEditorFind = useCallback((): void => {
    const targetPane = hoveredPaneRef.current ?? activePaneRef.current;
    const target = doubleModeRef.current && targetPane === "secondary" ? secondaryRef.current : primaryRef.current;
    target?.openFind();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "f") {
        return;
      }

      const target = event.target;
      const targetInEditor = target instanceof Element && target.closest(".editor-pane") !== null;
      if (!targetInEditor && hoveredPaneRef.current === null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openActiveEditorFind();
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [openActiveEditorFind]);

  const markHoveredPane = useCallback(
    (pane: PreviewFrameId): void => {
      hoveredPaneRef.current = pane;
      onActivePaneChange(pane);
    },
    [onActivePaneChange]
  );

  const clearHoveredPane = useCallback((pane: PreviewFrameId): void => {
    if (hoveredPaneRef.current === pane) {
      hoveredPaneRef.current = null;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        const target = doubleMode && activePane === "secondary" ? secondaryRef.current : primaryRef.current;
        target?.insertText(text);
      },
      focus: () => {
        const target = doubleMode && activePane === "secondary" ? secondaryRef.current : primaryRef.current;
        target?.focus();
      }
    }),
    [activePane, doubleMode]
  );

  const status = doubleMode
    ? `Top ${resolvedMode.toUpperCase()} / Bottom ${secondaryResolvedMode.toUpperCase()}`
    : resolvedMode.toUpperCase();

  return (
    <div className={`editor-pane ${doubleMode ? "editor-pane--double" : ""}`}>
      <div className="pane-header">
        <div>
          <h1>입력</h1>
          <p>{status}</p>
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

      <div className={doubleMode ? "editor-stack editor-stack--double" : "editor-stack"}>
        <section
          className="editor-stack__pane"
          aria-label="Top input"
          onPointerEnter={() => markHoveredPane("primary")}
          onPointerLeave={() => clearHoveredPane("primary")}
        >
          {doubleMode ? <div className="editor-stack__label">Top</div> : null}
          <CodeEditor
            ref={primaryRef}
            active={!doubleMode || activePane === "primary"}
            dark={dark}
            placeholderText="HTML 또는 Markdown을 붙여넣기"
            resolvedMode={resolvedMode}
            value={value}
            onChange={onChange}
            onFocus={() => onActivePaneChange("primary")}
          />
        </section>

        {doubleMode ? (
          <section
            className="editor-stack__pane"
            aria-label="Bottom input"
            onPointerEnter={() => markHoveredPane("secondary")}
            onPointerLeave={() => clearHoveredPane("secondary")}
          >
            <div className="editor-stack__label">Bottom</div>
            <CodeEditor
              ref={secondaryRef}
              active={activePane === "secondary"}
              dark={dark}
              placeholderText="비교할 HTML 또는 Markdown을 붙여넣기"
              resolvedMode={secondaryResolvedMode}
              value={secondaryValue}
              onChange={onSecondaryChange}
              onFocus={() => onActivePaneChange("secondary")}
            />
          </section>
        ) : null}
      </div>

      <div className="pane-actions">
        <IconButton icon={<FolderOpen size={16} />} label="열기" onClick={onOpenFile} />
        <IconButton icon={<ImagePlus size={16} />} label="이미지" onClick={onInsertImage} />
        <IconButton icon={<RotateCcw size={16} />} label="초기화" variant="danger" onClick={onClear} />
      </div>
    </div>
  );
});

export default EditorPane;
