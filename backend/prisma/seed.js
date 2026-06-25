import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// NOTE ON AFFILIATE LINKS
// affiliateLink points at each vendor's homepage as a placeholder. Once PartnerStack
// approves you and you join a program, replace the link with your real referral URL
// from the PartnerStack dashboard. Tools whose affiliateNetwork is "PartnerStack" are
// (at time of writing) available on the PartnerStack network — verify in your dashboard,
// since program availability changes.

const categories = [
  { slug: "ai", name: "AI Tools", iconKey: "Sparkles", colorPrimary: "#7C3AED", colorAccent: "#00F5FF", orderDisplay: 1,
    description: "Writing, image, code and chat assistants that do real work." },
  { slug: "trading", name: "Stock Trading", iconKey: "TrendingUp", colorPrimary: "#15803D", colorAccent: "#EF4444", orderDisplay: 2,
    description: "Charts, screeners and brokers for traders and investors." },
  { slug: "productivity", name: "Productivity", iconKey: "Zap", colorPrimary: "#1D4ED8", colorAccent: "#F59E0B", orderDisplay: 3,
    description: "Docs, tasks and workflows to keep your work in order." },
  { slug: "design", name: "Design", iconKey: "Palette", colorPrimary: "#DB2777", colorAccent: "#D946EF", orderDisplay: 4,
    description: "Interface, brand and creative tools for makers." },
  { slug: "dev", name: "Development", iconKey: "Code2", colorPrimary: "#0F766E", colorAccent: "#FACC15", orderDisplay: 5,
    description: "Build, ship and version your code faster." },
  { slug: "marketing", name: "Marketing", iconKey: "Megaphone", colorPrimary: "#EA580C", colorAccent: "#F97316", orderDisplay: 6,
    description: "Email, CRM and funnels to reach and keep customers." },
  { slug: "video", name: "Video & Audio", iconKey: "Video", colorPrimary: "#9333EA", colorAccent: "#22D3EE", orderDisplay: 7,
    description: "Record, edit and publish video and audio without a studio." },
  { slug: "support", name: "Customer Support", iconKey: "Headphones", colorPrimary: "#0891B2", colorAccent: "#34D399", orderDisplay: 8,
    description: "Help desks and live chat that keep customers happy." },
];

// cat slug -> tools
const tools = [
  // ───────────────────────── AI ─────────────────────────
  { cat: "ai", slug: "claude", name: "Claude", logoMono: "C", rating: 4.9, reviewCount: 3120, popularity: 98,
    priceMin: 0, priceMax: 20, priceType: "freemium", freeTrial: true, freeTier: true, isFeatured: true,
    affiliateLink: "https://claude.ai", affiliateNetwork: "Anthropic",
    description: "An AI you talk to like a sharp colleague who's read everything.",
    fullDescription: "Paste in a rambling email, a 40-page PDF, or a half-broken spreadsheet and ask it to fix, explain, or shorten it. People reach for Claude when the writing actually has to land — a proposal, an essay, a reply they can't get wrong. It's careful, it tells you when it's unsure instead of bluffing, and it won't pad three paragraphs to sound clever.",
    bestFor: "Writers, researchers, founders, and anyone who lives in long documents.",
    caveat: "No image generation, and the free tier has daily limits once you lean on it.",
    pros: ["Genuinely good at long, nuanced writing", "Free tier is generous enough to really test it", "Handles big documents without losing the thread"],
    features: [
      { featureName: "Long document analysis", description: "Reads and reasons over very large files in one go." },
      { featureName: "Honest uncertainty", description: "Flags when it isn't sure instead of inventing an answer." },
    ],
    reviews: [
      { title: "My default for anything that matters", rating: 5, isFeatured: true, useCase: "Writing client proposals",
        content: "I draft every proposal here first. The tone is professional without being stiff, and it catches gaps in my logic I'd have missed. Saves me a full edit pass." },
      { title: "Great for research, fewer hallucinations", rating: 5, useCase: "Academic research",
        content: "I feed it long papers and it summarises them accurately. When it doesn't know something it says so, which I've learned to trust." },
    ] },
  { cat: "ai", slug: "chatgpt", name: "ChatGPT", logoMono: "G", rating: 4.8, reviewCount: 9800, popularity: 99,
    priceMin: 0, priceMax: 20, priceType: "freemium", freeTrial: true, freeTier: true, isFeatured: true,
    affiliateLink: "https://chat.openai.com", affiliateNetwork: "OpenAI",
    description: "The all-rounder. If you only try one AI tool, this is usually it.",
    fullDescription: "It writes, codes, plans, brainstorms, makes images, reads your files, and talks back out loud. Nothing it does is the single best in its lane, but it does more things well than anything else, which is why half the planet opened an account. The free version covers most casual use, and the paid plan unlocks the smarter models.",
    bestFor: "First-timers and anyone who wants one tool that does a bit of everything.",
    caveat: "The good models sit behind the $20 plan; the free tier slows down under heavy load.",
    pros: ["Does almost everything passably well", "Huge free tier to learn on", "Endless tutorials and community help"],
    features: [
      { featureName: "Image generation", description: "Create images from a text prompt inside the same chat." },
      { featureName: "Voice mode", description: "Talk to it out loud and hear spoken replies." },
    ],
    reviews: [
      { title: "The Swiss army knife", rating: 5, isFeatured: true, useCase: "General daily use",
        content: "I use it for everything from meal plans to debugging code. It's never the absolute best at any one thing, but it's always good enough and it's always there." },
    ] },
  { cat: "ai", slug: "midjourney", name: "Midjourney", logoMono: "M", rating: 4.7, reviewCount: 5600, popularity: 90,
    priceMin: 10, priceMax: 60, priceType: "subscription", freeTrial: false, freeTier: false, isFeatured: true,
    affiliateLink: "https://midjourney.com", affiliateNetwork: "Midjourney",
    description: "Type a sentence, get an image that looks like a designer made it.",
    fullDescription: "Describe a scene — say, 'a foggy lighthouse at dawn, oil painting' — and you get four polished options in under a minute. It's the tool artists and brands quietly use when they want visuals that don't scream 'AI made this.' There's a knack to writing good prompts, but the ceiling is genuinely high.",
    bestFor: "Designers, marketers, and anyone who needs original visuals without hiring a photographer.",
    caveat: "No free trial, and you steer it through Discord, which feels strange for a day or two.",
    pros: ["Best-looking results in the category", "Fast — four images a minute", "Friendly community that teaches the prompt tricks"],
    reviews: [
      { title: "Worth it for the quality", rating: 5, useCase: "Marketing visuals",
        content: "Our blog headers all come from here now. They look hand-made, not stock. The Discord workflow is odd at first but you stop noticing after a week." },
    ] },
  { cat: "ai", slug: "perplexity", name: "Perplexity", logoMono: "Px", rating: 4.6, reviewCount: 2400, popularity: 84,
    priceMin: 0, priceMax: 20, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://perplexity.ai", affiliateNetwork: "Perplexity",
    description: "A search engine that answers in full sentences and cites its sources.",
    fullDescription: "Ask a real question and Perplexity reads the web for you, writes a clear answer, and links every claim so you can check it. It's the tool people switch to when ten blue links feel like too much work. The free version is plenty for everyday questions; paying unlocks the smarter models for deeper research.",
    bestFor: "Researchers, students, and anyone tired of wading through search results.",
    caveat: "For creative writing it's weaker than a general chatbot — it's built to find, not invent.",
    pros: ["Every answer is sourced and linked", "Genuinely faster than manual searching", "Free tier covers most questions"] },
  { cat: "ai", slug: "jasper", name: "Jasper", logoMono: "Js", rating: 4.3, reviewCount: 3100, popularity: 76,
    priceMin: 39, priceMax: 99, priceType: "subscription", freeTrial: true, freeTier: false,
    affiliateLink: "https://jasper.ai", affiliateNetwork: "PartnerStack",
    description: "AI writing built specifically for marketing teams and brand voice.",
    fullDescription: "Jasper is a writing assistant tuned for marketers: it learns your brand voice, plugs into your content workflow, and pumps out ad copy, blog posts, and product descriptions on brief. It costs more than a general chatbot, but teams pay for the templates, the brand controls, and the fact that it stays on-message.",
    bestFor: "Marketing teams producing a steady stream of on-brand copy.",
    caveat: "Pricey for individuals — a general AI tool is cheaper if you don't need brand controls.",
    pros: ["Learns and holds your brand voice", "Templates for every marketing format", "Built for teams, not just solo use"] },
  { cat: "ai", slug: "grammarly", name: "Grammarly", logoMono: "Gr", rating: 4.6, reviewCount: 12400, popularity: 89,
    priceMin: 0, priceMax: 30, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://grammarly.com", affiliateNetwork: "Grammarly",
    description: "A second pair of eyes on everything you type, everywhere you type it.",
    fullDescription: "Grammarly sits in your browser and apps, quietly catching typos, clunky sentences, and the wrong tone before you hit send. The free version fixes spelling and grammar; the paid tier rewrites for clarity and confidence. It's the kind of tool you forget is there until you turn it off and your writing gets worse.",
    bestFor: "Anyone who writes emails, reports, or posts and wants them to read clean.",
    caveat: "The best rewriting suggestions sit behind the premium plan.",
    pros: ["Works everywhere you write", "Solid free tier for the basics", "Catches tone problems, not just typos"] },
  { cat: "ai", slug: "elevenlabs", name: "ElevenLabs", logoMono: "11", rating: 4.7, reviewCount: 1900, popularity: 81,
    priceMin: 0, priceMax: 99, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://elevenlabs.io", affiliateNetwork: "ElevenLabs",
    description: "Turn text into voices that actually sound human.",
    fullDescription: "Paste a script and ElevenLabs reads it back in a natural voice — for narration, audiobooks, YouTube videos, or app prompts. The voices are convincing enough that listeners often can't tell. The free tier lets you generate a fair amount each month before you need a paid plan.",
    bestFor: "Creators, course makers, and developers adding voice to their work.",
    caveat: "Heavy use eats the free monthly character limit fast.",
    pros: ["The most natural-sounding voices around", "Big library of voices and languages", "Usable free tier to test on"] },

  // ───────────────────────── TRADING ─────────────────────────
  { cat: "trading", slug: "tradingview", name: "TradingView", logoMono: "Tv", rating: 4.7, reviewCount: 6400, popularity: 91,
    priceMin: 0, priceMax: 60, priceType: "freemium", freeTrial: true, freeTier: true, isFeatured: true,
    affiliateLink: "https://tradingview.com", affiliateNetwork: "TradingView",
    description: "The charts almost every trader online is actually looking at.",
    fullDescription: "Real-time charts for stocks, crypto, and forex, right in your browser with nothing to install. Draw your trendlines, set price alerts that ping your phone, and copy strategies other traders share publicly. The free plan is properly usable, which is rare here. Paying mostly removes ads and lets you stack more alerts and charts on one screen.",
    bestFor: "Anyone learning to trade, or who just wants clean charts without a pro terminal.",
    caveat: "The free tier shows ads and caps how many alerts you can set.",
    pros: ["Free plan is actually good, not a teaser", "Runs on any device", "Massive library of community indicators"],
    reviews: [
      { title: "The only chart I use", rating: 5, isFeatured: true, useCase: "Swing trading",
        content: "The free plan does more than tools I used to pay for. Alerts ping my phone the second a level breaks. Upgraded only to lose the ads." },
    ] },
  { cat: "trading", slug: "finviz", name: "Finviz", logoMono: "Fv", rating: 4.3, reviewCount: 1800, popularity: 68,
    priceMin: 0, priceMax: 40, priceType: "freemium", freeTrial: false, freeTier: true,
    affiliateLink: "https://finviz.com", affiliateNetwork: "Finviz",
    description: "A fast stock screener with the famous market heat map.",
    fullDescription: "Finviz is where a lot of people go to scan the whole market at a glance. The heat map shows you green and red across every sector in one screen, and the screener filters thousands of stocks by the numbers that matter to you. The free version covers most of what a casual investor needs.",
    bestFor: "Investors who want to scan the market quickly without paying for data.",
    caveat: "The interface looks dated, and real-time data needs the paid Elite plan.",
    pros: ["Excellent free screener", "The heat map is genuinely useful", "No account needed to start"] },
  { cat: "trading", slug: "koyfin", name: "Koyfin", logoMono: "Ky", rating: 4.5, reviewCount: 900, popularity: 62,
    priceMin: 0, priceMax: 79, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://koyfin.com", affiliateNetwork: "Koyfin",
    description: "Bloomberg-style research and data without the Bloomberg price.",
    fullDescription: "Koyfin gives long-term investors the dashboards, financials, and macro data that used to cost thousands a year. Track a watchlist, compare companies side by side, and dig into the fundamentals all in one clean interface. The free tier is surprisingly deep for fundamental research.",
    bestFor: "Long-term and fundamental investors who want serious data on a budget.",
    caveat: "Less focused on live charting than tools built for active traders.",
    pros: ["Institutional-grade data for free", "Clean, modern dashboards", "Great for comparing companies"] },
  { cat: "trading", slug: "benzinga-pro", name: "Benzinga Pro", logoMono: "Bz", rating: 4.2, reviewCount: 1400, popularity: 64,
    priceMin: 37, priceMax: 197, priceType: "subscription", freeTrial: true, freeTier: false,
    affiliateLink: "https://pro.benzinga.com", affiliateNetwork: "PartnerStack",
    description: "A real-time news feed built for traders who move on headlines.",
    fullDescription: "Benzinga Pro pushes market-moving news the moment it breaks, with audio squawk, a filterable feed, and alerts on the tickers you watch. Day traders use it to react before the move is over. It's a paid tool, but for news-driven trading the speed pays for itself.",
    bestFor: "Active and day traders who trade on breaking news.",
    caveat: "Overkill — and an unnecessary cost — for long-term buy-and-hold investors.",
    pros: ["News the second it breaks", "Audio squawk so you don't miss it", "Powerful filtering on the feed"] },

  // ───────────────────────── PRODUCTIVITY ─────────────────────────
  { cat: "productivity", slug: "notion", name: "Notion", logoMono: "N", rating: 4.6, reviewCount: 8200, popularity: 93,
    priceMin: 0, priceMax: 15, priceType: "freemium", freeTrial: true, freeTier: true, isFeatured: true,
    affiliateLink: "https://notion.so", affiliateNetwork: "PartnerStack",
    description: "One flexible app for your notes, docs, tasks, and team wiki.",
    fullDescription: "Instead of juggling a notes app, a to-do app, and a spreadsheet, you build your own setup inside Notion: a reading list, a project tracker, a whole company wiki, whatever shape your brain wants. That blank-page freedom is the appeal and also the catch — it does nothing until you build it. The free plan is plenty for one person.",
    bestFor: "Students, solo workers, and small teams who like organising things their own way.",
    caveat: "The freedom overwhelms some people; budget an afternoon to set it up the first time.",
    pros: ["Bends to almost any workflow", "Free for personal use", "Thousands of ready-made templates"],
    reviews: [
      { title: "Replaced four other apps", rating: 5, isFeatured: true, useCase: "Running a small team",
        content: "Wiki, tasks, docs, and our content calendar all live here now. Took an afternoon to set up and we haven't looked back." },
    ] },
  { cat: "productivity", slug: "monday", name: "monday.com", logoMono: "Mn", rating: 4.5, reviewCount: 9200, popularity: 90, isFeatured: true,
    priceMin: 0, priceMax: 24, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://monday.com", affiliateNetwork: "PartnerStack",
    description: "A colourful work platform that makes project status obvious at a glance.",
    fullDescription: "monday.com turns your work into bright, sortable boards where everyone can see what's done, what's stuck, and what's next. It scales from a simple task list to full-blown sales pipelines and product roadmaps. Teams like how visual it is — you understand a project's health in one glance, no meeting required.",
    bestFor: "Teams that want a visual, flexible way to run projects and processes.",
    caveat: "The per-seat pricing adds up quickly as your team grows.",
    pros: ["Highly visual and easy to read", "Automations cut out busywork", "Adapts to sales, projects, or HR"],
    reviews: [
      { title: "Our whole agency runs on it", rating: 5, useCase: "Agency project management",
        content: "Clients, deadlines, and deliverables all on one board. The colour coding means I can read the week's status in five seconds." },
    ] },
  { cat: "productivity", slug: "clickup", name: "ClickUp", logoMono: "Cu", rating: 4.4, reviewCount: 7100, popularity: 85,
    priceMin: 0, priceMax: 19, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://clickup.com", affiliateNetwork: "PartnerStack",
    description: "One app that tries to replace your tasks, docs, goals, and chat.",
    fullDescription: "ClickUp packs an enormous amount into one tool — tasks, docs, whiteboards, goals, time tracking — so teams can drop three or four subscriptions. That breadth is the draw and the risk: it can feel busy until you switch off the parts you don't need. The free tier is unusually generous.",
    bestFor: "Teams who want to consolidate several tools into one and will invest time tuning it.",
    caveat: "Feature-dense — the interface can overwhelm new users at first.",
    pros: ["Enormous free tier", "Replaces several other tools", "Endlessly customisable views"] },
  { cat: "productivity", slug: "asana", name: "Asana", logoMono: "As", rating: 4.4, reviewCount: 5100, popularity: 79,
    priceMin: 0, priceMax: 25, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://asana.com", affiliateNetwork: "Asana",
    description: "Project and task management built to keep a team on track.",
    fullDescription: "Asana turns a messy project into a clear list of who's doing what by when. You can view the same work as a checklist, a board, or a timeline, and nothing falls through the cracks because every task has an owner and a due date. It's structured where Notion is a blank page.",
    bestFor: "Teams running projects with real deadlines and handoffs.",
    caveat: "Can feel heavy for a solo user or a tiny team.",
    pros: ["Clear ownership on every task", "Multiple views of the same work", "Solid free tier for small teams"] },
  { cat: "productivity", slug: "todoist", name: "Todoist", logoMono: "Td", rating: 4.6, reviewCount: 4800, popularity: 78,
    priceMin: 0, priceMax: 6, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://todoist.com", affiliateNetwork: "Todoist",
    description: "A fast, no-nonsense to-do list that syncs everywhere.",
    fullDescription: "Todoist does one thing brilliantly: capture a task in seconds and never lose it. Type 'pay rent every 1st' and it schedules a recurring reminder automatically. It syncs across phone, laptop, and browser, and the free tier is enough for most people to run their whole life on.",
    bestFor: "Anyone who wants a simple, reliable personal task manager.",
    caveat: "Light on team features compared to full project tools.",
    pros: ["Captures tasks in seconds", "Natural-language scheduling", "Syncs flawlessly across devices"] },
  { cat: "productivity", slug: "calendly", name: "Calendly", logoMono: "Cl", rating: 4.7, reviewCount: 6900, popularity: 87,
    priceMin: 0, priceMax: 16, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://calendly.com", affiliateNetwork: "Calendly",
    description: "End the email back-and-forth of finding a meeting time.",
    fullDescription: "Share one Calendly link and people book a slot that's actually free on your calendar — no 'does Tuesday work?' threads. It handles time zones, buffers, and reminders automatically. Sales teams, recruiters, and freelancers live by it. The free plan covers one meeting type, which is enough for most individuals.",
    bestFor: "Anyone who schedules calls with people outside their company.",
    caveat: "Multiple meeting types and team routing need a paid plan.",
    pros: ["Kills scheduling email entirely", "Handles time zones for you", "Free tier works for solo use"] },

  // ───────────────────────── DESIGN ─────────────────────────
  { cat: "design", slug: "figma", name: "Figma", logoMono: "F", rating: 4.8, reviewCount: 9100, popularity: 94,
    priceMin: 0, priceMax: 45, priceType: "freemium", freeTrial: true, freeTier: true, isFeatured: true,
    affiliateLink: "https://figma.com", affiliateNetwork: "Figma",
    description: "Design real screens and websites, together, in the browser.",
    fullDescription: "Designers build app screens and sites in Figma while teammates watch the cursor move and comment live, like Google Docs for design. Nothing to install. If you've ever waited on someone to 'send the latest file,' this quietly kills that whole problem. The free plan covers small projects and solo learning comfortably.",
    bestFor: "Product teams, freelancers, and anyone learning interface design.",
    caveat: "Very large files can lag on older laptops.",
    pros: ["Real-time collaboration that just works", "Runs in any browser", "Free tier is enough to learn on"],
    reviews: [
      { title: "Killed the 'send me the file' problem", rating: 5, isFeatured: true, useCase: "Product design team",
        content: "We moved the whole team over. Everyone's always on the latest version because there's only ever one version. Comments live on the canvas. Perfect." },
    ] },
  { cat: "design", slug: "canva", name: "Canva", logoMono: "Cv", rating: 4.6, reviewCount: 15000, popularity: 92,
    priceMin: 0, priceMax: 15, priceType: "freemium", freeTrial: true, freeTier: true, isFeatured: true,
    affiliateLink: "https://canva.com", affiliateNetwork: "Canva",
    description: "Drag-and-drop design for people who aren't designers.",
    fullDescription: "Canva hands you thousands of templates for social posts, slides, flyers, and more, and you just swap in your text and photos. No design skills needed. It's how most small businesses make their graphics without hiring anyone, and the free plan does a remarkable amount.",
    bestFor: "Small businesses, creators, and anyone who needs a decent graphic fast.",
    caveat: "Templates can look generic if you don't customise them.",
    pros: ["Genuinely easy for beginners", "Huge free template library", "Works in the browser and on mobile"] },
  { cat: "design", slug: "framer", name: "Framer", logoMono: "Fr", rating: 4.6, reviewCount: 2600, popularity: 80,
    priceMin: 0, priceMax: 30, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://framer.com", affiliateNetwork: "Framer",
    description: "Design a website and publish it live — no separate build step.",
    fullDescription: "Framer blurs the line between designing and shipping a site. You lay out pages visually, add real animations, and hit publish to a live URL. Designers love that the thing they design is the thing that goes live, with no developer handoff for simple marketing sites.",
    bestFor: "Designers and founders who want a polished site without writing code.",
    caveat: "For complex web apps you'll still need real development.",
    pros: ["Design and publish in one place", "Beautiful animations built in", "Fast, modern hosting included"] },
  { cat: "design", slug: "looka", name: "Looka", logoMono: "Lk", rating: 4.3, reviewCount: 1700, popularity: 60,
    priceMin: 20, priceMax: 96, priceType: "paid", freeTrial: false, freeTier: false,
    affiliateLink: "https://looka.com", affiliateNetwork: "PartnerStack",
    description: "Generate a real logo and brand kit in a few minutes.",
    fullDescription: "Answer a few questions about your business and Looka's AI generates dozens of logo options. Pick one, tweak the colours and fonts, and walk away with a full brand kit — logo files, social images, business cards. It's how a lot of new businesses get a respectable logo without a designer's invoice.",
    bestFor: "New businesses and side projects that need a decent logo fast and cheap.",
    caveat: "AI-generated branding won't match a bespoke designer for a serious company.",
    pros: ["A usable logo in minutes", "Full brand kit, not just a logo", "Far cheaper than hiring out"] },

  // ───────────────────────── DEVELOPMENT ─────────────────────────
  { cat: "dev", slug: "copilot", name: "GitHub Copilot", logoMono: "</>", rating: 4.6, reviewCount: 4300, popularity: 88,
    priceMin: 10, priceMax: 39, priceType: "subscription", freeTrial: true, freeTier: false, isFeatured: true,
    affiliateLink: "https://github.com/features/copilot", affiliateNetwork: "GitHub",
    description: "Autocomplete that finishes whole lines — sometimes whole functions — of code.",
    fullDescription: "As you type, it suggests the next line in grey; you hit Tab and it's written. For the repetitive 80% of coding — boilerplate, tests, the function you've written a hundred times — it's a real time-saver. It's confidently wrong now and then, so you still read what it gives you, but most developers who try it leave it switched on.",
    bestFor: "Developers at any level who want to type less of the boring stuff.",
    caveat: "It will suggest wrong code with total confidence, so review every line.",
    pros: ["Saves real time on repetitive code", "Works inside editors you already use", "Cheap for what you get back"] },
  { cat: "dev", slug: "vercel", name: "Vercel", logoMono: "▲", rating: 4.8, reviewCount: 3000, popularity: 86,
    priceMin: 0, priceMax: 150, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://vercel.com", affiliateNetwork: "Vercel",
    description: "Deploy a website in seconds, straight from your code repo.",
    fullDescription: "Push your code to GitHub, connect it to Vercel, and your site is live on a real URL in under a minute — with automatic previews for every change. It's the default home for React and Next.js apps for good reason. The free tier is enough to host personal projects and small sites.",
    bestFor: "Frontend developers shipping React, Next.js, or static sites.",
    caveat: "Costs can climb on high-traffic commercial sites.",
    pros: ["Effortless deploys from Git", "Preview URL for every change", "Generous free tier for hobby projects"] },
  { cat: "dev", slug: "netlify", name: "Netlify", logoMono: "Nl", rating: 4.6, reviewCount: 2700, popularity: 79,
    priceMin: 0, priceMax: 99, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://netlify.com", affiliateNetwork: "Netlify",
    description: "Host and deploy modern websites with zero server setup.",
    fullDescription: "Netlify takes your repo and turns it into a fast, globally hosted site on every push, with forms, functions, and previews built in. It's a favourite for static sites and JAMstack apps. The free tier comfortably hosts personal sites and small projects.",
    bestFor: "Developers shipping static sites and JAMstack apps.",
    caveat: "Build-minute and bandwidth limits on the free tier can bite a busy site.",
    pros: ["Deploys on every git push", "Forms and functions built in", "Solid free tier"] },
  { cat: "dev", slug: "supabase", name: "Supabase", logoMono: "Sb", rating: 4.7, reviewCount: 2200, popularity: 82,
    priceMin: 0, priceMax: 25, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://supabase.com", affiliateNetwork: "Supabase",
    description: "A full backend — database, auth, storage — without building one.",
    fullDescription: "Supabase gives you a Postgres database, user authentication, file storage, and instant APIs out of the box, so you can build an app's backend in an afternoon. It's the open-source favourite for indie devs and startups. The free tier runs a real project, not just a demo.",
    bestFor: "Developers who want a real backend without managing servers.",
    caveat: "You'll want to understand SQL to get the most out of it.",
    pros: ["Database, auth, and storage in one", "Built on standard Postgres", "Genuinely usable free tier"] },
  { cat: "dev", slug: "digitalocean", name: "DigitalOcean", logoMono: "DO", rating: 4.6, reviewCount: 5400, popularity: 84,
    priceMin: 4, priceMax: 200, priceType: "subscription", freeTrial: true, freeTier: false,
    affiliateLink: "https://digitalocean.com", affiliateNetwork: "PartnerStack",
    description: "Cloud servers that developers can actually understand and afford.",
    fullDescription: "DigitalOcean offers simple, predictably priced cloud servers ('droplets'), managed databases, and app hosting without the sprawling complexity of the big clouds. Developers and small teams pick it because the pricing is clear and the docs are excellent. You can spin up a server for a few dollars a month.",
    bestFor: "Developers and small teams who want straightforward, affordable cloud hosting.",
    caveat: "Fewer managed services than the giant cloud providers.",
    pros: ["Clear, predictable pricing", "Famously good documentation", "Simple enough to learn on"] },
  { cat: "dev", slug: "postman", name: "Postman", logoMono: "Pm", rating: 4.6, reviewCount: 6100, popularity: 83,
    priceMin: 0, priceMax: 29, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://postman.com", affiliateNetwork: "Postman",
    description: "The standard tool for testing and exploring APIs.",
    fullDescription: "Postman lets developers fire requests at an API, inspect the responses, and save whole collections to share with a team — no throwaway scripts. It's so common that 'send it in Postman' is just how developers talk. The free tier covers individuals and small teams comfortably.",
    bestFor: "Any developer who works with APIs, which is most of them.",
    caveat: "Has grown feature-heavy; newcomers only need a fraction of it.",
    pros: ["The de facto standard for API testing", "Share collections across a team", "Strong free tier"] },

  // ───────────────────────── MARKETING ─────────────────────────
  { cat: "marketing", slug: "mailchimp", name: "Mailchimp", logoMono: "Mc", rating: 4.2, reviewCount: 6700, popularity: 80,
    priceMin: 0, priceMax: 20, priceType: "freemium", freeTrial: true, freeTier: true, isFeatured: true,
    affiliateLink: "https://mailchimp.com", affiliateNetwork: "Mailchimp",
    description: "Send newsletters and automated emails without a designer or any code.",
    fullDescription: "Drag blocks around, drop in your logo, hit send to your whole list. Set it up once and new subscribers get a welcome email automatically while you sleep. It's the friendly default for small businesses and creators starting a list, and the free plan lets you grow to a few hundred subscribers before you pay anything.",
    bestFor: "Small businesses, creators, and anyone starting an email list from scratch.",
    caveat: "Gets pricey as your list grows, and the better features sit on higher tiers.",
    pros: ["Free up to a starter-size list", "Genuinely easy drag-and-drop builder", "Automations that run themselves"] },
  { cat: "marketing", slug: "activecampaign", name: "ActiveCampaign", logoMono: "AC", rating: 4.5, reviewCount: 5200, popularity: 83, isFeatured: true,
    priceMin: 15, priceMax: 145, priceType: "subscription", freeTrial: true, freeTier: false,
    affiliateLink: "https://activecampaign.com", affiliateNetwork: "PartnerStack",
    description: "Email marketing plus a CRM, with automation that goes deep.",
    fullDescription: "ActiveCampaign is where businesses graduate to when a basic newsletter tool stops being enough. Its visual automation builder lets you send the right email based on what a contact actually does, and the built-in CRM keeps sales and marketing on the same page. Powerful, with a learning curve to match.",
    bestFor: "Growing businesses that want serious email automation and a CRM in one.",
    caveat: "More than a simple newsletter sender needs — and no free tier.",
    pros: ["Deep, visual automation", "CRM and email in one place", "Scales from small to large lists"],
    reviews: [
      { title: "Our revenue engine", rating: 5, useCase: "Ecommerce automation",
        content: "Abandoned-cart and win-back flows run themselves and quietly bring in sales every day. It took a couple of weeks to learn but it's paid for itself many times over." },
    ] },
  { cat: "marketing", slug: "convertkit", name: "Kit (ConvertKit)", logoMono: "Kt", rating: 4.5, reviewCount: 3400, popularity: 77,
    priceMin: 0, priceMax: 100, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://kit.com", affiliateNetwork: "Kit",
    description: "Email marketing built specifically for creators and writers.",
    fullDescription: "Kit (formerly ConvertKit) is designed for creators who sell through their audience — newsletters, courses, digital products. Tagging and automation are simple, the signup forms are clean, and you can sell products right from the platform. The free tier supports a starter list.",
    bestFor: "Creators, writers, and course sellers building an audience by email.",
    caveat: "Plainer email designs than tools aimed at big brands.",
    pros: ["Made for creators, not corporations", "Sell products directly", "Free tier to start a list"] },
  { cat: "marketing", slug: "brevo", name: "Brevo", logoMono: "Bv", rating: 4.3, reviewCount: 2900, popularity: 72,
    priceMin: 0, priceMax: 65, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://brevo.com", affiliateNetwork: "PartnerStack",
    description: "Email, SMS, and chat marketing with a genuinely free plan.",
    fullDescription: "Brevo (formerly Sendinblue) bundles email campaigns, SMS, and live chat, and prices by emails sent rather than list size — so a big list doesn't punish you. Small businesses like that the free tier allows unlimited contacts. A practical, affordable all-rounder.",
    bestFor: "Small businesses that want email plus SMS without per-contact pricing.",
    caveat: "The daily send limit on the free plan is tight.",
    pros: ["Pricing by sends, not list size", "Unlimited contacts even when free", "Email, SMS, and chat together"] },
  { cat: "marketing", slug: "semrush", name: "Semrush", logoMono: "Sr", rating: 4.5, reviewCount: 7800, popularity: 86, isFeatured: true,
    priceMin: 0, priceMax: 450, priceType: "subscription", freeTrial: true, freeTier: true,
    affiliateLink: "https://semrush.com", affiliateNetwork: "Semrush",
    description: "The all-in-one toolkit for SEO and competitor research.",
    fullDescription: "Semrush tells you which keywords your competitors rank for, where your own site is winning and losing, and what content to write next. Marketers use it to plan SEO that actually moves traffic. It's a serious, paid platform — the limited free account lets you taste it first.",
    bestFor: "Marketers and site owners serious about growing search traffic.",
    caveat: "Genuinely expensive, and overkill for a tiny hobby site.",
    pros: ["See exactly what competitors rank for", "Huge keyword and backlink database", "One tool for the whole SEO workflow"] },
  { cat: "marketing", slug: "unbounce", name: "Unbounce", logoMono: "Ub", rating: 4.3, reviewCount: 2100, popularity: 70,
    priceMin: 99, priceMax: 625, priceType: "subscription", freeTrial: true, freeTier: false,
    affiliateLink: "https://unbounce.com", affiliateNetwork: "PartnerStack",
    description: "Build high-converting landing pages without a developer.",
    fullDescription: "Unbounce lets marketers drag together landing pages designed to convert, then A/B test them to squeeze out more sign-ups and sales. It's built around one job — turning ad clicks into customers — and does it well. A paid tool aimed at people running real campaigns.",
    bestFor: "Marketers running paid ads who need dedicated landing pages that convert.",
    caveat: "Priced for businesses, not hobby projects.",
    pros: ["Built specifically for conversions", "Easy A/B testing", "No developer needed"] },

  // ───────────────────────── VIDEO & AUDIO ─────────────────────────
  { cat: "video", slug: "descript", name: "Descript", logoMono: "Ds", rating: 4.6, reviewCount: 3300, popularity: 81, isFeatured: true,
    priceMin: 0, priceMax: 24, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://descript.com", affiliateNetwork: "Descript",
    description: "Edit video and podcasts by editing the text transcript.",
    fullDescription: "Descript transcribes your recording, then lets you edit the video or audio by deleting words in the transcript — cut a sentence from the text and it's gone from the video. It removes filler 'ums' automatically and can even fix a flubbed line. It makes editing feel like word processing.",
    bestFor: "Podcasters, YouTubers, and anyone who edits talking-head video.",
    caveat: "Less suited to cinematic, effects-heavy video editing.",
    pros: ["Edit video by editing text", "Removes filler words automatically", "Auto-transcription built in"],
    reviews: [
      { title: "Cut my editing time in half", rating: 5, useCase: "Podcast production",
        content: "Editing by deleting text is genuinely magic. The automatic 'um' removal alone saves me an hour per episode." },
    ] },
  { cat: "video", slug: "loom", name: "Loom", logoMono: "Lo", rating: 4.6, reviewCount: 5600, popularity: 84,
    priceMin: 0, priceMax: 15, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://loom.com", affiliateNetwork: "Loom",
    description: "Record your screen and face, share a link, skip the meeting.",
    fullDescription: "Hit record, talk through what's on your screen, and Loom gives you a shareable link the moment you stop. It's how teams replace 'quick call?' with a two-minute video the other person watches whenever. Free tier covers a healthy number of short videos.",
    bestFor: "Remote teams, support, and anyone who explains things over screen-share.",
    caveat: "Free plan caps video length and how many you can keep.",
    pros: ["Record and share in seconds", "Replaces a lot of meetings", "Viewers don't need an account"] },
  { cat: "video", slug: "riverside", name: "Riverside", logoMono: "Rv", rating: 4.5, reviewCount: 1600, popularity: 71,
    priceMin: 0, priceMax: 29, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://riverside.fm", affiliateNetwork: "Riverside",
    description: "Record studio-quality remote podcasts and interviews.",
    fullDescription: "Riverside records each guest locally in high quality, so a shaky connection doesn't wreck the audio or video. You come away with crisp, separate tracks ready to edit. It's become a go-to for remote interview shows that care about how they sound and look.",
    bestFor: "Podcasters and shows recording remote guests who want pro quality.",
    caveat: "Local recording needs guests on a decent browser and connection.",
    pros: ["Records each guest in high quality locally", "Separate tracks for easy editing", "Video and audio in one"] },
  { cat: "video", slug: "vimeo", name: "Vimeo", logoMono: "Vm", rating: 4.4, reviewCount: 4200, popularity: 76,
    priceMin: 0, priceMax: 65, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://vimeo.com", affiliateNetwork: "PartnerStack",
    description: "Professional video hosting without the ads and clutter.",
    fullDescription: "Vimeo hosts your videos cleanly — no ads, no 'recommended' clutter, full control over privacy and branding. Businesses use it for course content, client work, and embedded marketing videos where YouTube's distractions won't do. The free tier covers a modest library.",
    bestFor: "Businesses and creators who want clean, professional video hosting.",
    caveat: "Smaller audience reach than YouTube — it's for hosting, not discovery.",
    pros: ["No ads or distractions", "Full control over privacy", "Clean embeds for your site"] },

  // ───────────────────────── CUSTOMER SUPPORT ─────────────────────────
  { cat: "support", slug: "intercom", name: "Intercom", logoMono: "Ic", rating: 4.4, reviewCount: 4900, popularity: 82, isFeatured: true,
    priceMin: 29, priceMax: 132, priceType: "subscription", freeTrial: true, freeTier: false,
    affiliateLink: "https://intercom.com", affiliateNetwork: "Intercom",
    description: "Live chat, help desk, and AI support bundled into one messenger.",
    fullDescription: "Intercom puts a chat bubble on your site that handles support, onboarding, and sales in one place, with an AI agent that can resolve common questions before a human steps in. It's the polished, full-featured option that growing SaaS companies tend to land on.",
    bestFor: "SaaS and online businesses that want chat, help desk, and AI in one.",
    caveat: "Among the pricier options as your contact volume grows.",
    pros: ["Chat, help desk, and AI together", "Strong automation and bots", "Polished customer experience"],
    reviews: [
      { title: "Cut our support tickets way down", rating: 5, useCase: "SaaS customer support",
        content: "The AI agent now resolves most of the repetitive questions on its own. Our team only sees the ones that actually need a human. Worth the price for us." },
    ] },
  { cat: "support", slug: "freshdesk", name: "Freshdesk", logoMono: "Fd", rating: 4.4, reviewCount: 5800, popularity: 80,
    priceMin: 0, priceMax: 79, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://freshdesk.com", affiliateNetwork: "PartnerStack",
    description: "A friendly help desk that turns support emails into tidy tickets.",
    fullDescription: "Freshdesk collects support requests from email, chat, and social into one tidy queue, so nothing gets lost and the whole team can see who's handling what. It's approachable and well-priced, with a free tier that genuinely works for a small team starting out.",
    bestFor: "Small and mid-size teams that need an organised, affordable help desk.",
    caveat: "The most advanced automation sits on higher-priced tiers.",
    pros: ["Real, usable free tier", "All channels in one queue", "Easy for a team to pick up"] },
  { cat: "support", slug: "gorgias", name: "Gorgias", logoMono: "Go", rating: 4.5, reviewCount: 2300, popularity: 73,
    priceMin: 10, priceMax: 360, priceType: "subscription", freeTrial: true, freeTier: false,
    affiliateLink: "https://gorgias.com", affiliateNetwork: "PartnerStack",
    description: "A help desk built specifically for ecommerce stores.",
    fullDescription: "Gorgias plugs straight into Shopify and shows the customer's full order history right next to their message, so your team can refund, cancel, or track an order without leaving the ticket. For online stores it removes a huge amount of tab-switching and speeds up every reply.",
    bestFor: "Ecommerce stores, especially on Shopify, drowning in customer messages.",
    caveat: "Built around ecommerce — less of a fit for non-store businesses.",
    pros: ["Order details right in the ticket", "Deep Shopify integration", "Automates common store questions"] },
  { cat: "support", slug: "tidio", name: "Tidio", logoMono: "Ti", rating: 4.5, reviewCount: 3100, popularity: 69,
    priceMin: 0, priceMax: 49, priceType: "freemium", freeTrial: true, freeTier: true,
    affiliateLink: "https://tidio.com", affiliateNetwork: "Tidio",
    description: "Live chat and chatbots that small businesses can set up in minutes.",
    fullDescription: "Tidio drops a chat widget on your site and pairs it with simple bots that answer FAQs and capture leads while you sleep. It's aimed at small businesses that want live chat without enterprise complexity or pricing, and the free tier lets you start right away.",
    bestFor: "Small businesses and stores that want live chat plus simple bots, cheaply.",
    caveat: "Fewer advanced features than the big enterprise platforms.",
    pros: ["Up and running in minutes", "Free tier to start", "Bots capture leads automatically"] },
];

const blogPosts = [
  { slug: "ai-tools-that-save-hours", cat: "ai", title: "7 AI tools that actually save you hours each week", readTime: 6,
    tools: ["claude", "perplexity", "grammarly", "elevenlabs", "chatgpt"],
    excerpt: "We tested the hype. These are the ones that earned a spot in our own workflow.",
    content: "Most AI tools promise the moon and deliver a screenshot. After a year of trying nearly everything that launched, only a handful are still open in our browser every day. These are the ones that survived the novelty wearing off — and, more importantly, the ones that genuinely give time back.\n\n![Claude:Long-form writing|Perplexity:Sourced answers|Grammarly:Proofing everywhere|ElevenLabs:Voiceovers|ChatGPT:Everything else](fig:stack 'The five that earn their place')\n\n## 1. Claude, for the writing that has to land\n\nWhen a reply can't be wrong — a proposal, a sensitive email, a piece of writing with your name on it — this is the one we trust. It handles long documents without losing the thread, and it tells you when it's unsure instead of inventing an answer. We draft most long-form work here first and edit down, which reliably saves an hour a day.\n\n## 2. Perplexity, for answers you can actually cite\n\nInstead of ten blue links and twenty minutes of reading, you ask a real question and get a written answer with every claim sourced. For research where you need to check the original, it's faster than searching by hand and far harder to mislead.\n\n## 3. Grammarly, as the safety net\n\nIt sits in your browser and quietly fixes typos, clunky sentences, and the wrong tone before you hit send. You forget it's there until you turn it off and your writing visibly gets worse.\n\n## 4. ElevenLabs, for voiceovers without a booth\n\nPaste a script and get natural narration in minutes — for videos, course content, or app prompts. The free monthly allowance is enough to see whether it fits your workflow.\n\n## 5. ChatGPT, as the everything-else tool\n\nNothing it does is the single best in its lane, but it does more things passably than anything else: brainstorming, quick code, image ideas, summarising a messy file. It's the default for the long tail of small tasks.\n\n## The honest catch\n\nNone of these replace judgement. They draft, summarise, and accelerate — you still decide what's good. Used that way, the time saved is real and adds up fast. Start with the free tiers; only pay once a tool has earned it." },
  { slug: "best-trading-platforms-beginners", cat: "trading", title: "Best trading platforms for beginners in 2026", readTime: 9,
    tools: ["tradingview", "finviz", "koyfin", "benzinga-pro"],
    excerpt: "Paper trading, low fees, clean charts. Where to start without losing your shirt.",
    content: "Starting out in the market, the tools matter less than the discipline — but the right software makes it far easier to learn without expensive mistakes. You really only need three things at the beginning: clean charts, a way to scan the market, and solid research. Here's where to start, and what each tool is actually for.\n\n![Learn the charts:TradingView|Scan the market:Finviz|Research deeply:Koyfin|React to news:Benzinga Pro](fig:steps 'A sensible order to start in')\n\n## Start with the charts: TradingView\n\nTradingView is where most traders online actually look at the market. It runs in your browser, the free plan is genuinely usable (not a teaser), and you can set price alerts that ping your phone. Crucially for beginners, it lets you practise on the chart and follow strategies other traders share publicly. Learn to read a chart here before you risk a cent.\n\n## Scan the market: Finviz\n\nOnce you can read one stock, you need a way to find candidates among thousands. Finviz's free screener filters the whole market by the numbers you care about, and its famous heat map shows green and red across every sector in a single glance. No account needed to start.\n\n## Do your homework: Koyfin\n\nIf you lean toward longer-term investing, Koyfin gives you the kind of research dashboards and fundamentals that used to cost thousands a year — comparing companies side by side, tracking a watchlist, digging into the financials. The free tier is surprisingly deep.\n\n## When you're ready to move faster: Benzinga Pro\n\nThis one is not for beginners on day one. But once you're trading actively and reacting to news, a real-time news feed with audio squawk earns its keep. File it under \"later.\"\n\n## The rule that matters more than any tool\n\nLearn on the free tiers, paper trade until you're consistently not losing, and only put real money in once you understand exactly why you're entering and exiting. The software is the easy part — risk management is the skill. Trading involves real risk, and nothing here is financial advice." },
  { slug: "notion-vs-asana", cat: "productivity", title: "Notion vs Asana: which wins for small teams?", readTime: 7,
    tools: ["notion", "asana", "monday", "clickup"],
    excerpt: "One's a blank canvas, one's a freight train. Here's how to pick the right one.",
    content: "Notion and Asana get compared constantly, but they solve the same problem from opposite ends. Pick the wrong one and you'll spend weeks fighting the tool instead of doing the work. Here's how to tell which side you're on.\n\n## The core difference\n\nNotion hands you a blank page and near-infinite flexibility. Asana hands you a structured system for getting projects done. One is a canvas; the other is a conveyor belt. Neither is better — they're better at different things.\n\n![Notion:A blank canvas. Flexible, build-it-yourself|Asana:A structured system. Deadlines and owners](fig:vs 'Same problem, opposite ends')\n\n## Choose Notion if…\n\nYou want one flexible space for docs, notes, wikis, and light task tracking, and you enjoy (or at least don't mind) building your own setup. Notion shines as a team's knowledge base and home for everything written down. The catch: that freedom does nothing until you build it, so budget an afternoon to set it up, and expect some people to find the blank page overwhelming.\n\n## Choose Asana if…\n\nYou run projects with real deadlines, owners, and handoffs, and you want structure out of the box. Every task has a person and a due date, and you can view the same work as a list, a board, or a timeline. Nothing slips through the cracks. It can feel heavy for a solo user, but for a team shipping work on a schedule, that structure is the point.\n\n## The setup most teams actually land on\n\nIn practice, plenty of teams use both: Notion for knowledge — docs, processes, the wiki — and a dedicated execution tool for the actual project work. If Asana feels too rigid, look at monday.com, which is more visual, or ClickUp, which crams tasks, docs, and goals into one app. Try the free tiers of two before committing; the right feel matters more than the feature list." },
  { slug: "best-email-marketing-tools", cat: "marketing", title: "The best email marketing tools for every budget", readTime: 8,
    tools: ["mailchimp", "brevo", "convertkit", "activecampaign"],
    excerpt: "From a free first newsletter to deep automation. Where to start and when to upgrade.",
    content: "Your email list is the one audience you truly own — no algorithm sits between you and the people who asked to hear from you. That makes the tool you build it with one of the more important early decisions. Here's how to choose, from your first newsletter to serious automation.\n\n![Mailchimp or Brevo:Start free|Kit:Built for creators|ActiveCampaign:Serious automation plus CRM](fig:tiers 'Where to start, and when to upgrade')\n\n## Just starting out: Mailchimp or Brevo\n\nIf you're sending your first campaigns, both have free tiers and friendly drag-and-drop builders. Mailchimp is the familiar default and easy to learn on. Brevo (formerly Sendinblue) prices by emails sent rather than list size, so a growing list doesn't quietly inflate your bill — and it allows unlimited contacts even on the free plan. Pick Mailchimp for simplicity, Brevo if you expect a big list or want SMS too.\n\n## For creators: Kit\n\nIf you're a writer, course-seller, or creator monetising an audience, Kit (formerly ConvertKit) is built for exactly that. Tagging and automation are simple, the signup forms are clean, and you can sell digital products straight from the platform. The designs are plainer than brand-focused tools, but for creators that's rarely the point.\n\n## When you outgrow the basics: ActiveCampaign\n\nSooner or later a simple newsletter tool stops being enough — you want emails that fire based on what someone actually did, and a CRM so sales and marketing share one view. ActiveCampaign is where serious senders graduate to. Its visual automation builder is genuinely powerful, with a learning curve to match, and there's no free tier. But abandoned-cart and win-back flows that run themselves tend to pay for the subscription many times over.\n\n## The honest path\n\nStart free, learn what you actually need from real campaigns, then upgrade with intent. Don't pay for deep automation before you have a list to automate to — and don't cling to a free tool once it's visibly costing you sales." },
  { slug: "edit-video-by-editing-text", cat: "video", title: "How editing video by editing text changes everything", readTime: 5,
    tools: ["descript", "loom", "riverside"],
    excerpt: "Descript turns video editing into word processing. Here's why creators are switching.",
    content: "Traditional video editing has a learning curve steep enough to stop most people before they start — timelines, tracks, keyframes, an interface designed for professionals. Descript throws that model out for one simple idea, and for a huge range of video it just works.\n\n![Record:Talk to camera|Auto-transcribe:Descript writes it up|Edit the text:Delete words to cut clips|Export:Publish anywhere](fig:steps 'Editing becomes word processing')\n\n## The core trick\n\nDescript transcribes your recording, then lets you edit the video or audio by editing the transcript. Delete a sentence of text and it's gone from the footage. Rearrange paragraphs and the clips move with them. If you can edit a document, you can edit a video. For anyone who's bounced off traditional editors, this is the unlock.\n\n## Filler words, gone in one click\n\nEvery \"um,\" \"uh,\" and awkward pause gets detected automatically, and you can strip them all across the entire recording in a single action. On a talking-head video or podcast, that alone can save an hour an episode.\n\n## Where it fits — and where it doesn't\n\nDescript is built for spoken-word video: podcasts, tutorials, course lessons, YouTube talking-head content, internal explainers. It's not the tool for cinematic, effects-heavy, music-video editing — reach for a traditional editor there. But that's a minority of what most people actually make.\n\n## The wider shift\n\nDescript is part of a broader move toward video tools that don't require a film-school workflow. Pair it with Loom for quick screen recordings you share as a link, or Riverside for recording remote interviews in studio quality, and a one-person creator can produce work that looked impossible a few years ago — without ever opening a traditional timeline." },
  { slug: "best-customer-support-software", cat: "support", title: "Customer support software: how to pick the right help desk", readTime: 7,
    tools: ["gorgias", "intercom", "freshdesk", "tidio"],
    excerpt: "Live chat, ticketing, AI agents. Match the tool to the kind of business you run.",
    content: "There's no single \"best\" help desk — the right one depends entirely on what you sell, how customers reach you, and how many of them there are. Choosing by feature-list comparison is how teams end up overpaying for software that doesn't fit. Start instead from the kind of business you run.\n\n![Gorgias:For stores. Order data in the ticket|Intercom:For SaaS. Chat plus an AI agent](fig:vs 'Match the tool to your business')\n\n## Running an online store? Gorgias\n\nIf most of your support is \"where's my order\" and \"can I get a refund,\" you want the customer's order history sitting right next to their message. Gorgias plugs straight into Shopify and does exactly that, so your team can refund, cancel, or track an order without leaving the ticket. For a busy store, the time saved on tab-switching alone justifies it.\n\n## A growing SaaS? Intercom\n\nSoftware businesses tend to need chat, a help desk, onboarding messages, and increasingly an AI agent that resolves common questions before a human steps in. Intercom bundles all of that into one polished messenger. It's among the pricier options as volume grows, but the AI deflecting repetitive tickets changes the math for a lot of teams.\n\n## On a budget, or just starting? Freshdesk or Tidio\n\nBoth have genuinely usable free tiers. Freshdesk turns scattered support emails into one tidy ticket queue and is easy for a small team to pick up. Tidio focuses on live chat plus simple bots that capture leads while you sleep, and it's up and running in minutes. Either lets you look professional without a budget.\n\n## How to actually decide\n\nMap the tool to your channels and volume, not to the longest feature list. An ecommerce store and a SaaS startup have different jobs to do, and the best tool is the one that fits the job — then start on a free or trial plan before you commit a budget." },
  { slug: "free-tools-to-start-a-business", cat: "productivity", title: "12 free tools you can start a business with today", readTime: 10,
    tools: ["notion", "todoist", "calendly", "canva", "looka", "figma", "mailchimp", "loom", "tidio", "supabase"],
    excerpt: "You can stand up a real business on free tiers alone. Here's the starter stack.",
    content: "One of the quiet truths of starting something today is how little it has to cost. The free tiers of modern software are good enough to run a real business on — not crippled demos, but genuinely usable plans. Here's a starter stack, grouped by the job it does, that costs nothing to begin.\n\n![Notion:Docs and wiki|Todoist:Tasks|Calendly:Booking|Canva:Graphics|Mailchimp:Email|Tidio:Live chat](fig:stack 'A whole business on free tiers')\n\n## Organise the work\n\n**Notion** is your home base: docs, a wiki, notes, and light task tracking in one flexible space, free for personal use. Pair it with **Todoist** for fast personal task capture — type \"invoice client every 1st\" and it schedules itself. And **Calendly** kills the back-and-forth of booking calls: share one link and people pick a slot that's actually free on your calendar.\n\n## Build the brand\n\n**Canva** lets you make social posts, slides, and flyers from templates with zero design skill, and its free tier does a remarkable amount. Need a logo? **Looka** generates a respectable one in minutes (its core kit is paid, but you can design for free before you buy). Designing an app or a proper website layout? **Figma** is free to learn on and the industry standard.\n\n## Reach and keep customers\n\n**Mailchimp** gets your first newsletter out the door on a free starter list. **Loom** replaces a lot of meetings — record your screen, share a link, done. And **Tidio** puts live chat and simple bots on your site so visitors can reach you (and you can capture leads) from day one.\n\n## If you're building software\n\n**Supabase** gives you a real backend — database, user authentication, and file storage — on a free tier that runs an actual project, not just a toy. For a technical founder, that's a genuine head start.\n\n## The principle\n\nDon't pay until a free limit is actively holding you back. Most of these only need upgrading once you have real traction — by which point the cost is an easy yes. Start free, prove the idea, then spend." },
  { slug: "ai-image-tools-compared", cat: "ai", title: "Midjourney vs the rest: which AI image tool should you use?", readTime: 6,
    tools: ["midjourney", "chatgpt", "canva"],
    excerpt: "The honest trade-offs between the leading AI image generators.",
    content: "AI image generators have converged enough that the gap between them is narrower than the hype suggests — but they still have distinct personalities, and the right one depends on what you're making and how much polish you need.\n\n![Midjourney:Best quality. Discord setup, no free trial|ChatGPT:Instant and convenient. Lower polish](fig:vs 'Quality versus convenience')\n\n## Midjourney, for sheer quality\n\nIf the image is going in front of clients or customers, Midjourney still wins on polish. Describe a scene and you get four genuinely striking options in under a minute — results that look hand-made rather than obviously AI-generated. The trade-offs: there's no free trial, and you steer it through Discord, which feels strange for a day or two and then becomes invisible. There's also a real skill to writing good prompts, but the ceiling is high enough to be worth learning.\n\n## ChatGPT, for convenience\n\nWhen you just need a quick image in the same place you're already working — drafting a post, sketching an idea — generating it right inside ChatGPT is hard to beat for convenience. The quality won't match Midjourney's best, but for a fast concept, a blog thumbnail, or a throwaway visual, it's right there and good enough.\n\n## Canva, for putting the image to work\n\nWorth remembering that a raw generated image usually isn't the finished product — it goes into a post, a slide, a flyer. Canva now bundles AI generation alongside its templates, so for non-designers making real marketing assets, generating and laying out in one place often beats juggling a separate tool.\n\n## How to choose\n\nFor anything where the visual quality is the point, Midjourney. For speed and convenience inside an existing workflow, ChatGPT. For turning an image into a finished marketing asset, Canva. Most people end up using more than one — and that's the right answer, not a failure to pick." },
];

const testimonials = [
  { toolSlug: "claude", userName: "Maya R.", userTitle: "Content Lead", rating: 5, content: "I draft everything in Claude first now. It saves me an hour a day, easily." },
  { toolSlug: "tradingview", userName: "Devon K.", userTitle: "Swing Trader", rating: 5, content: "The free plan does more than platforms I used to pay for. Alerts alone are worth it." },
  { toolSlug: "figma", userName: "Sam P.", userTitle: "Product Designer", rating: 5, content: "Switched the whole team over. Never going back to emailing files around." },
  { toolSlug: "monday", userName: "Priya N.", userTitle: "Agency Owner", rating: 5, content: "I can read my whole team's week in five seconds. That visibility changed how we run projects." },
  { toolSlug: "descript", userName: "Marcus T.", userTitle: "Podcaster", rating: 5, content: "Editing by deleting text still feels like cheating. It halved my production time." },
  { toolSlug: "activecampaign", userName: "Elena V.", userTitle: "Ecommerce Founder", rating: 5, content: "Our automated flows quietly bring in sales every single day. It's our best-paying employee." },
  { toolSlug: "calendly", userName: "Tom B.", userTitle: "Sales Consultant", rating: 5, content: "I haven't sent a 'does Tuesday work?' email in two years. One link does it all." },
  { toolSlug: "intercom", userName: "Aisha M.", userTitle: "Head of Support", rating: 5, content: "The AI agent handles the repetitive questions so my team only touches the ones that matter." },
];

// Site-level testimonials — readers talking about Toolhaven itself (no toolId).
// Surfaced on the home page. NOTE: these are starter placeholders written to read
// naturally; swap in real reader quotes as you collect them.
const siteTestimonials = [
  { userName: "Hannah Beckett", userTitle: "Freelance writer · Leeds", rating: 5,
    content: "I was about two clicks from paying for the wrong project tool. The review here flat-out said the free option would cover everything I needed — and it does. Saved me about £150 a year and a whole afternoon of buyer's remorse." },
  { userName: "Daniel Okonkwo", userTitle: "Startup founder", rating: 5,
    content: "What sold me is that they actually tell you what's annoying about each tool. Every other 'best of' list reads like a press release. This one reads like a mate who's genuinely tried all of them and isn't trying to sell you anything." },
  { userName: "Priyanka Shah", userTitle: "Marketing manager", rating: 5,
    content: "Sent the compare page to my team and it settled a two-week argument about which CRM to use in about ten minutes. Should've found this site sooner, honestly." },
  { userName: "Marco Bianchi", userTitle: "Indie developer", rating: 4,
    content: "I came in pretty cynical — it's another tools directory, right? Then I read the caveats on something I already use day to day and they nailed the exact thing that drives me up the wall. Won me over." },
  { userName: "Sofia Almeida", userTitle: "Small business owner", rating: 5,
    content: "No fake five-star everything. When they say a free tier is actually generous, it actually is. That kind of honesty is rare enough that I now check here before I buy any software." },
  { userName: "James Whitfield", userTitle: "Operations lead", rating: 5,
    content: "Found three tools I needed in the time it usually takes me to get halfway through one of those endless listicles. No pop-ups, no fluff, straight to what matters. Bookmarked the whole site." },
  { userName: "Aisha Rahman", userTitle: "Content creator", rating: 5,
    content: "The writing is the thing. Plain English, real opinions, and they clearly use the tools instead of copy-pasting the marketing page. I trust a recommendation here more than a sponsored YouTube review." },
];

async function main() {
  console.log("Clearing existing data…");
  await prisma.affiliateClick.deleteMany();
  await prisma.blogPostTool.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.toolReview.deleteMany();
  await prisma.toolFeature.deleteMany();
  await prisma.toolPro.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.tool.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();

  console.log("Seeding categories…");
  const catMap = {};
  for (const c of categories) {
    const created = await prisma.category.create({ data: c });
    catMap[c.slug] = created.id;
  }

  console.log("Seeding tools…");
  const toolMap = {};
  for (const t of tools) {
    const { cat, pros, features, reviews, ...rest } = t;
    const created = await prisma.tool.create({
      data: {
        ...rest,
        categoryId: catMap[cat],
        pros: { create: pros.map((text) => ({ text })) },
        features: features ? { create: features } : undefined,
        reviews: reviews ? { create: reviews } : undefined,
      },
    });
    toolMap[t.slug] = created.id;
  }

  console.log("Seeding blog posts…");
  for (const p of blogPosts) {
    const { cat, tools: toolSlugs = [], ...rest } = p;
    const links = toolSlugs
      .filter((s) => toolMap[s])
      .map((s, i) => ({ toolId: toolMap[s], mentionOrder: i }));
    await prisma.blogPost.create({
      data: {
        ...rest,
        categoryId: catMap[cat],
        toolLinks: links.length ? { create: links } : undefined,
      },
    });
  }

  console.log("Seeding testimonials…");
  for (const tm of testimonials) {
    const { toolSlug, ...rest } = tm;
    await prisma.testimonial.create({ data: { ...rest, toolId: toolMap[toolSlug] } });
  }

  console.log("Seeding site testimonials…");
  for (const tm of siteTestimonials) {
    await prisma.testimonial.create({ data: tm });
  }

  console.log("Done. Seeded", Object.keys(catMap).length, "categories and", Object.keys(toolMap).length, "tools.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
