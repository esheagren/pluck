import { useEffect, useRef, useState, type JSX } from 'react';

// Mermaid is ~2 MB; load it only on the page that needs it.
type MermaidModule = typeof import('mermaid')['default'];
let mermaidPromise: Promise<MermaidModule> | null = null;
function loadMermaid(dark: boolean): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: dark ? 'dark' : 'neutral',
        fontFamily: 'Inter, system-ui, sans-serif',
        sequence: { useMaxWidth: true, mirrorActors: false, wrap: true },
        // Flow/class diagrams get wide; render at natural size and scroll horizontally
        // rather than shrinking text to fit. Sequence diagrams scale to the container.
        flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis', nodeSpacing: 40, rankSpacing: 60 },
        class: { useMaxWidth: false },
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

interface Props {
  id: string;
  source: string;
  dark: boolean;
}

/** Renders Mermaid text to SVG; shows the parser's message instead of crashing on bad input. */
export default function MermaidDiagram({ id, source, dark }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    // Theme is fixed at initialize(); re-initialise if it changed.
    mermaidPromise = null;
    loadMermaid(dark)
      .then(async (mermaid) => {
        try {
          await mermaid.parse(source);
          const { svg } = await mermaid.render(`mmd-${id}-${Date.now()}`, source);
          if (!cancelled) { setSvg(svg); setError(null); }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        }
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [id, source, dark]);

  return (
    <div className="w-full overflow-x-auto">
      {error && (
        <pre className="mb-3 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </pre>
      )}
      <div ref={ref} className="[&>svg]:mx-auto [&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
