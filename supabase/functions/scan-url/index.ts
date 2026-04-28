import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScanResult {
  url: string;
  finalUrl: string;
  html: string;
  robotsTxt: string | null;
  sitemapXml: string | null;
  faviconExists: boolean;
  manifestJson: string | null;
  error?: string;
}

async function fetchText(url: string, timeout = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AudFlo-Scanner/1.0 (+https://audflo.com)" },
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    // Only return text-based responses
    if (!ct.includes("text") && !ct.includes("json") && !ct.includes("xml")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchBinaryOk(url: string, timeout = 6000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "AudFlo-Scanner/1.0 (+https://audflo.com)" },
    });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const rawUrl: string = body.url ?? "";
    if (!rawUrl) {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize URL
    let normalizedUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = "https://" + normalizedUrl;
    }
    const parsedUrl = new URL(normalizedUrl);
    const origin = parsedUrl.origin;

    // Fetch all resources in parallel
    const [html, robotsTxt, sitemapXml, faviconExists, manifestJson] = await Promise.all([
      fetchText(normalizedUrl),
      fetchText(`${origin}/robots.txt`),
      fetchText(`${origin}/sitemap.xml`),
      fetchBinaryOk(`${origin}/favicon.ico`),
      fetchText(`${origin}/manifest.json`).then(t => t ?? fetchText(`${origin}/manifest.webmanifest`)),
    ]);

    if (!html) {
      return new Response(
        JSON.stringify({ error: "Could not fetch the page. It may block automated requests or be unavailable." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result: ScanResult = {
      url: normalizedUrl,
      finalUrl: normalizedUrl,
      html,
      robotsTxt,
      sitemapXml,
      faviconExists,
      manifestJson,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
