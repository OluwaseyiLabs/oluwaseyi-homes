import type { ReactNode } from "react";

/** **bold** inside a line. Everything else is shown as plain text, so nothing typed in the dashboard can inject markup. */
const inline = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : part));

/** Shows a legal page's text: "## " headings, "### " smaller headings, "- " lists and paragraphs. */
export function LegalBody({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`l${blocks.length}`} className="mt-3 list-disc space-y-2 pl-6">
        {list.map((li, i) => <li key={i}>{inline(li)}</li>)}
      </ul>,
    );
    list = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- ")) { list.push(line.slice(2)); continue; }
    flush();
    if (!line) continue;
    if (line.startsWith("### ")) blocks.push(<h3 key={blocks.length} className="mt-6 text-lg font-bold text-ink">{inline(line.slice(4))}</h3>);
    else if (line.startsWith("## ")) blocks.push(<h2 key={blocks.length} className="mt-10 text-2xl font-extrabold tracking-tight text-ink">{inline(line.slice(3))}</h2>);
    else blocks.push(<p key={blocks.length} className="mt-3">{inline(line)}</p>);
  }
  flush();
  return <div className="text-lg leading-8 text-muted">{blocks}</div>;
}
