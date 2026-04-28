export default function JsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://audflo.com/#organization",
        "name": "AudFlo",
        "url": "https://audflo.com",
        "logo": {
          "@type": "ImageObject",
          "url": "https://audflo.com/og-image.png"
        },
        "description": "AudFlo is a no-code Slack automation builder. Visual editor, conditional branching, 200+ connectors — the replacement for Slack's legacy Workflow Builder retired September 26, 2024.",
        "sameAs": [
          "https://twitter.com/mattQR",
          "https://linkedin.com/company/audflo"
        ],
        "knowsAbout": ["SaaS", "no-code automation", "Slack integration", "workflow automation", "Steps from Apps replacement"]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://audflo.com/#product",
        "name": "AudFlo",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": "https://audflo.com",
        "description": "No-code Slack workflow builder alternative to Slack's legacy Workflow Builder. Drag-and-drop editor with conditional branching, 200+ integrations, and run history.",
        "offers": [
          {
            "@type": "Offer",
            "name": "Starter",
            "price": "0",
            "priceCurrency": "USD",
            "description": "Up to 2 active flows, 100 runs/month, all 200+ connectors, community support."
          },
          {
            "@type": "Offer",
            "name": "Pro",
            "price": "12",
            "priceCurrency": "USD",
            "billingIncrement": "month",
            "description": "Unlimited flows, 10,000 runs/month, conditional branching, run history, priority support."
          },
          {
            "@type": "Offer",
            "name": "Team",
            "description": "Custom pricing. SSO, SCIM, audit logs, version history, multi-workspace, SOC 2 reports."
          }
        ]
      },
      {
        "@type": "WebSite",
        "@id": "https://audflo.com/#website",
        "url": "https://audflo.com",
        "name": "AudFlo",
        "description": "No-code Slack automation builder — the replacement for Slack's legacy Workflow Builder.",
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://audflo.com/?q={search_term_string}"
          },
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://audflo.com/#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What happened to Slack's legacy Workflow Builder?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Slack retired the legacy Workflow Builder on September 26, 2024. The retirement also removed Steps from Apps, the third-party integration layer that powered tools like Zapier integration. Existing workflows stopped running with no direct migration path, and the replacement requires Deno and TypeScript — making it inaccessible to the non-developer teams who originally built workflows on the platform."
            }
          },
          {
            "@type": "Question",
            "name": "How is AudFlo different from Slack's new Workflow Builder?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "AudFlo is no-code, drag-and-drop, and includes a 200+ connector library on day one. Slack's new Workflow Builder requires developers to build custom steps using Deno and TypeScript. AudFlo also runs as an external service connected via OAuth, meaning your automations survive future Slack platform changes."
            }
          },
          {
            "@type": "Question",
            "name": "Is AudFlo a Slack replacement?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. AudFlo connects to Slack via OAuth and adds an automation layer on top. You keep using Slack for messaging — AudFlo handles the workflows."
            }
          },
          {
            "@type": "Question",
            "name": "What integrations does AudFlo support at launch?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "AudFlo launches with 200+ integrations including Google Sheets, Notion, Airtable, Linear, HubSpot, Salesforce, GitHub, Stripe, Zendesk, Intercom, Microsoft Teams, Asana, Trello, Monday.com, ClickUp, and a universal webhook connector for everything else."
            }
          },
          {
            "@type": "Question",
            "name": "How much does AudFlo cost?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "AudFlo offers a Free tier ($0 forever) with 2 active flows and 100 runs per month, a Pro tier ($12 per editor per month) with unlimited flows and 10,000 runs, and a Team tier with custom pricing for organizations needing SSO, SCIM, audit logs, and SOC 2 compliance. Founding members lock in 50% off Pro for life."
            }
          },
          {
            "@type": "Question",
            "name": "Will AudFlo work with Microsoft Teams or Discord?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "AudFlo launches Slack-first, with Microsoft Teams and Discord support planned for Q3 2026. Your AudFlo flows will work cross-platform once those integrations ship."
            }
          },
          {
            "@type": "Question",
            "name": "Can I migrate my old legacy Workflow Builder flows to AudFlo?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. We provide a free migration service for the first 100 founding members. Send us a description of your workflow (or screenshots from your old workflow editor) and we will rebuild it in AudFlo and load it directly into your account."
            }
          },
          {
            "@type": "Question",
            "name": "When does AudFlo launch publicly?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "AudFlo enters private beta in Q1 2026 with founding waitlist members. Public launch is targeted for Q2 2026."
            }
          }
        ]
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
