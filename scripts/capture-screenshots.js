const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const edge =
  '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"';
const outDir = path.resolve(__dirname, "../docs/images");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const targets = [
  { url: "http://localhost:3000", name: "hero-landing.png" },
  { url: "http://localhost:3000/?mode=personal", name: "personal-mode.png" },
  {
    url: "http://localhost:3000/?mode=freelancer",
    name: "freelancer-mode.png",
  },
  { url: "http://localhost:3000/?mode=family", name: "family-mode.png" },
  { url: "http://localhost:3000/?mode=business", name: "business-mode.png" },
  { url: "http://localhost:3000/proof", name: "proof-center.png" },
];

for (const t of targets) {
  const filePath = path.join(outDir, t.name);
  console.log(`Capturing ${t.url} -> ${t.name}...`);
  try {
    execSync(
      `${edge} --headless --screenshot="${filePath}" --window-size=1400,900 "${t.url}"`,
      {
        timeout: 20000,
        stdio: "inherit",
      },
    );
    console.log(`Saved: ${filePath}`);
  } catch (err) {
    console.error(`Failed to capture ${t.url}:`, err.message);
  }
}
console.log("Finished capturing all screenshots.");
