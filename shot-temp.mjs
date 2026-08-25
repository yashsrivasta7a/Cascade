import { chromium } from "playwright";

const OUT = process.argv[2];
const stats = {
  stats: {
    totalWorkflows: { value: 12, change: "+3", changeLabel: "from last month" },
    executionsToday: { value: 37, change: "+18%", changeLabel: "from yesterday" },
    avgRuntime: { value: "4.2s", change: "-0.3s", changeLabel: "improvement" },
    successRate: { value: "98.2%", change: "+1.4%", changeLabel: "this week" },
  },
  recentActivity: [
    { id: "1", workflow: "Product shots — batch 04", status: "success", time: "2m ago", duration: "3.1s" },
    { id: "2", workflow: "Voiceover render", status: "warning", time: "14m ago" },
    { id: "3", workflow: "Trailer merge + audio", status: "error", time: "1h ago", duration: "22s" },
    { id: "4", workflow: "Blog illustrations", status: "success", time: "3h ago", duration: "8.4s" },
    { id: "5", workflow: "Weekly digest LLM", status: "success", time: "5h ago", duration: "1.9s" },
    { id: "6", workflow: "Crop + upscale pass", status: "success", time: "yesterday", duration: "12s" },
  ],
  activeWorkflows: 2,
  credits: { used: 1000, total: 5000, remaining: 849000 },
};
const balance = { credits: 849000, formatted: "849k", dollarValue: "8.49" };

const browser = await chromium.launch();

for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);

  const page = await ctx.newPage();
  await page.route("**/api/trpc/**", async (route) => {
    const url = route.request().url();
    const body = [];
    // batch link: paths are comma separated after /api/trpc/
    const paths = decodeURIComponent(url.split("/api/trpc/")[1].split("?")[0]).split(",");
    for (const p of paths) {
      body.push({ result: { data: p.includes("credits") ? balance : stats } });
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("http://localhost:3000/dashboard-design", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/sidebar-${theme}.png`, clip: { x: 0, y: 0, width: 340, height: 900 } });

  // collapsed
  await page.keyboard.press("[");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/sidebar-${theme}-collapsed.png`, clip: { x: 0, y: 0, width: 200, height: 900 } });

  await ctx.close();
}

await browser.close();
console.log("shots done");
