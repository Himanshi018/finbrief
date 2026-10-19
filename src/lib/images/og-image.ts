const USER_AGENT = "FinBrief/1.0";
const FETCH_TIMEOUT_MS = 5_000;
/** og:image sits in <head>; stop reading long pages after this much HTML. */
const MAX_HTML_BYTES = 400_000;

/**
 * ET image URLs point at a full-size original (/photo/, often 1-5 MB) or a
 * 4:3 crop with an ET logo overlay (/thumb/, used for og:image). Both map to
 * the same photo as a clean 16:9 thumbnail at a fraction of the size.
 */
export function resizeKnownCdn(url: string): string {
  // msid comes first on news pages (/thumb/msid-N,...) and last on tech pages (/thumb/width-...,msid-N/...)
  const et = url.match(/^https?:\/\/img\.etimg\.com\/(?:photo|thumb)\/[^/]*\bmsid-(\d+)/);
  return et ? `https://img.etimg.com/thumb/msid-${et[1]},width-800,height-450,resizemode-4/photo.jpg` : url;
}

function readAttr(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] ?? null;
}

/** First <meta> whose property/name is one of `keys` (in priority order). */
function findMeta(html: string, keys: string[]): string | null {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => tag);
  for (const key of keys) {
    for (const tag of metas) {
      const name = (readAttr(tag, "property") ?? readAttr(tag, "name"))?.toLowerCase();
      const content = name === key ? readAttr(tag, "content") : null;
      if (content) return content;
    }
  }
  return null;
}

async function readHtml(res: Response): Promise<string> {
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  while (html.length < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    // Everything we need is in <head>
    if (/<\/head>/i.test(html)) break;
  }
  await reader.cancel().catch(() => {});
  return html;
}

/**
 * The publisher's own share image (og:image, else twitter:image) for an
 * article page: the same news photo NewsAPI used to return as urlToImage.
 * One request with a short timeout; null on any failure.
 */
export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
      next: { revalidate: 0 },
    });
    if (!res.ok || !/html/i.test(res.headers.get("content-type") ?? "")) return null;

    const html = await readHtml(res);
    const raw = findMeta(html, ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
    if (!raw) return null;
    const url = new URL(raw.replace(/&amp;/gi, "&").trim(), res.url || pageUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? resizeKnownCdn(url.toString()) : null;
  } catch {
    return null;
  }
}
