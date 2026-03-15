// --- Types ---

type OpmlOutline = {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
  type?: string;
};

type OpmlImportResult = {
  added: number;
  skipped: number;
  sources: { name: string; url: string; status: 'added' | 'skipped' }[];
};

// --- Export ---

const buildOpml = (sources: { name: string; url: string; type: string }[]): string => {
  const outlines = sources
    .map((s) => {
      const title = escapeXml(s.name);
      const xmlUrl = escapeXml(s.url);
      return `      <outline text="${title}" title="${title}" type="rss" xmlUrl="${xmlUrl}" />`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Editions Sources</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    <outline text="Editions" title="Editions">
${outlines}
    </outline>
  </body>
</opml>`;
};

// --- Import ---

const parseOpml = (xml: string): OpmlOutline[] => {
  const outlines: OpmlOutline[] = [];
  // Match <outline> elements that have xmlUrl (double or single quoted)
  const outlineRegex = /<outline\s[^>]*xmlUrl\s*=\s*["']([^"']*)["'][^>]*\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = outlineRegex.exec(xml)) !== null) {
    const element = match[0];
    const rawXmlUrl = match[1];
    if (!rawXmlUrl) {
      continue;
    }
    const xmlUrl = decodeXml(rawXmlUrl);

    const titleMatch = element.match(/\btitle\s*=\s*["']([^"']*)["']/i);
    const textMatch = element.match(/\btext\s*=\s*["']([^"']*)["']/i);
    const typeMatch = element.match(/\btype\s*=\s*["']([^"']*)["']/i);

    const rawTitle = titleMatch?.[1] ?? textMatch?.[1] ?? undefined;
    const title = rawTitle !== undefined ? decodeXml(rawTitle) : xmlUrl;

    outlines.push({
      title,
      xmlUrl,
      type: typeMatch?.[1],
    });
  }

  return outlines;
};

// --- Helpers ---

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const decodeXml = (str: string): string =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

// --- Exports ---

export type { OpmlOutline, OpmlImportResult };
export { buildOpml, parseOpml };
