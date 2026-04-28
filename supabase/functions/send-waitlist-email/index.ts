import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, intent } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isReserve = intent !== "notify";

    const subject = isReserve
      ? "You're on the AudFlo waitlist — your spot is reserved"
      : "You'll be notified when AudFlo launches";

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background: #080a0a; font-family: 'IBM Plex Mono', 'Courier New', monospace; color: #e8eaea; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .header { border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 20px; margin-bottom: 32px; }
    .logo { font-size: 13px; letter-spacing: 3px; color: rgba(255,255,255,0.3); text-transform: uppercase; }
    .accent { color: #00ff88; }
    h1 { font-family: 'Inter', 'Helvetica Neue', sans-serif; font-size: 26px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.2; color: #ffffff; margin: 0 0 12px; }
    .subtitle { font-size: 12px; line-height: 1.75; color: rgba(255,255,255,0.45); margin: 0 0 32px; }
    .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px 22px; margin-bottom: 24px; }
    .card-label { font-size: 9px; letter-spacing: 2.5px; color: rgba(255,255,255,0.25); text-transform: uppercase; margin-bottom: 10px; }
    .card-title { font-family: 'Inter', 'Helvetica Neue', sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; margin-bottom: 8px; letter-spacing: -0.01em; }
    .card-body { font-size: 12px; line-height: 1.7; color: rgba(255,255,255,0.45); }
    .highlight-card { background: rgba(0,255,136,0.04); border-color: rgba(0,255,136,0.2); }
    .highlight-card .card-title { color: #00ff88; }
    .item { display: flex; gap: 10px; font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.6; margin-bottom: 8px; }
    .bullet { color: #00ff88; flex-shrink: 0; }
    .footer { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px; margin-top: 32px; font-size: 10px; color: rgba(255,255,255,0.18); line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo"><span class="accent">[</span> AUDFLO <span class="accent">]</span></div>
    </div>

    <h1>${isReserve ? "You're in. Your spot is reserved." : "You'll be notified at launch."}</h1>
    <p class="subtitle">
      ${isReserve
        ? `We've saved your early-access spot at <strong style="color:#e8eaea">${email}</strong>.<br/>Founding members get <strong style="color:#00ff88">50% off Pro for life</strong> — locked in at $7.50/month when we launch.`
        : `We'll reach out to <strong style="color:#e8eaea">${email}</strong> the moment AudFlo is live.`
      }
    </p>

    ${isReserve ? `
    <div class="card highlight-card">
      <div class="card-label">What you unlocked</div>
      <div class="card-title">Founding Member Benefits</div>
      <div class="card-body">
        <div class="item"><span class="bullet">+</span> 50% off Pro for life (locked in at $7.50/mo)</div>
        <div class="item"><span class="bullet">+</span> 15+ tailored distribution posts ready to paste</div>
        <div class="item"><span class="bullet">+</span> Weekly execution plan for your product</div>
        <div class="item"><span class="bullet">+</span> Content angles that get cited by AI</div>
        <div class="item"><span class="bullet">+</span> Priority access before public launch</div>
      </div>
    </div>
    ` : ""}

    <div class="card">
      <div class="card-label">While you wait</div>
      <div class="card-title">Run your free AI visibility scan</div>
      <div class="card-body">
        Find out exactly why AI isn't recommending your product — and get a clear picture of what's missing before we build your full distribution plan together.
      </div>
    </div>

    <div class="card">
      <div class="card-label">One favor</div>
      <div class="card-title">Reply and tell us your biggest distribution problem</div>
      <div class="card-body">
        What's the #1 reason you're not getting traction from AI-driven discovery? Reply to this email — we read every response and it shapes what we build first.
      </div>
    </div>

    <div class="footer">
      You're receiving this because you joined the AudFlo waitlist at audflo.com.<br />
      AudFlo — AI visibility &amp; distribution for indie founders.
    </div>
  </div>
</body>
</html>`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-waitlist-email] RESEND_API_KEY not set");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AudFlo <hello@audflo.com>",
        to: [email],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[send-waitlist-email] Resend error:", err);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-waitlist-email] unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
