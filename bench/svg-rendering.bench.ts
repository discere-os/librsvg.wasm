/**
 * LibRSVG.wasm Performance Benchmarks
 */

import LibRSVG from "../src/lib/index.ts";
import { SVGColorspace } from "../src/lib/types.ts";

// Test SVGs of varying complexity
const SIMPLE_SVG =
  `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="red"/>
</svg>`;

const MEDIUM_SVG =
  `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:red"/>
      <stop offset="100%" style="stop-color:blue"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#grad1)"/>
  <circle cx="100" cy="100" r="80" fill="white" opacity="0.5"/>
  <text x="100" y="110" text-anchor="middle" font-size="20">Test</text>
</svg>`;

const COMPLEX_SVG =
  `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="radial" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:white"/>
      <stop offset="100%" style="stop-color:black"/>
    </radialGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#radial)"/>
  ${
    Array.from({ length: 50 }, (_, i) =>
      `<circle cx="${50 + (i % 8) * 40}" cy="${
        50 + Math.floor(i / 8) * 40
      }" r="15"
     fill="hsl(${i * 7}, 70%, 50%)" opacity="0.7"/>`).join("\\n")
  }
  <text x="200" y="380" text-anchor="middle" font-size="24" filter="url(#blur)">
    Complex SVG with ${50} elements
  </text>
</svg>`;

let lib: LibRSVG | null = null;

// Setup before benchmarks
try {
  lib = new LibRSVG();
  await lib.initialize();
  console.log("LibRSVG initialized for benchmarking");
} catch (_error) {
  console.log(
    "LibRSVG initialization failed - benchmarks will show expected errors",
  );
  lib = new LibRSVG(); // Create instance anyway for structure testing
}

// Benchmark: Simple SVG rendering
Deno.bench(
  "Simple SVG (100×100, solid fill)",
  { group: "svg-rendering" },
  async () => {
    if (!lib) return;

    try {
      await lib.render(SIMPLE_SVG, { width: 100, height: 100 });
    } catch {
      // Expected during stub phase
    }
  },
);

// Benchmark: Medium complexity SVG
Deno.bench("Medium SVG (200×200, gradient + shapes)", {
  group: "svg-rendering",
}, async () => {
  if (!lib) return;

  try {
    await lib.render(MEDIUM_SVG, { width: 200, height: 200 });
  } catch {
    // Expected during stub phase
  }
});

// Benchmark: Complex SVG with many elements
Deno.bench(
  "Complex SVG (400×400, 50+ elements)",
  { group: "svg-rendering" },
  async () => {
    if (!lib) return;

    try {
      await lib.render(COMPLEX_SVG, { width: 400, height: 400 });
    } catch {
      // Expected during stub phase
    }
  },
);

// Benchmark: Different output sizes
Deno.bench("Small output (64×64)", { group: "output-sizes" }, async () => {
  if (!lib) return;

  try {
    await lib.render(MEDIUM_SVG, { width: 64, height: 64 });
  } catch {
    // Expected during stub phase
  }
});

Deno.bench("Large output (800×600)", { group: "output-sizes" }, async () => {
  if (!lib) return;

  try {
    await lib.render(MEDIUM_SVG, { width: 800, height: 600 });
  } catch {
    // Expected during stub phase
  }
});

Deno.bench("HD output (1920×1080)", { group: "output-sizes" }, async () => {
  if (!lib) return;

  try {
    await lib.render(MEDIUM_SVG, { width: 1920, height: 1080 });
  } catch {
    // Expected during stub phase
  }
});

// Benchmark: Different colorspaces
Deno.bench("RGBA colorspace", { group: "colorspaces" }, async () => {
  if (!lib) return;

  try {
    await lib.render(SIMPLE_SVG, {
      width: 200,
      height: 200,
      colorspace: SVGColorspace.RGBA,
    });
  } catch {
    // Expected during stub phase
  }
});

Deno.bench("RGB colorspace", { group: "colorspaces" }, async () => {
  if (!lib) return;

  try {
    await lib.render(SIMPLE_SVG, {
      width: 200,
      height: 200,
      colorspace: SVGColorspace.RGB,
    });
  } catch {
    // Expected during stub phase
  }
});

// Benchmark: SVG parsing vs rendering
Deno.bench(
  "SVG info extraction (parse only)",
  { group: "operations" },
  async () => {
    if (!lib) return;

    try {
      await lib.getImageInfo(COMPLEX_SVG);
    } catch {
      // Expected during stub phase
    }
  },
);

Deno.bench("Full SVG rendering", { group: "operations" }, async () => {
  if (!lib) return;

  try {
    await lib.render(COMPLEX_SVG, { width: 400, height: 400 });
  } catch {
    // Expected during stub phase
  }
});

// Benchmark: Memory usage patterns
Deno.bench("Multiple small renders", { group: "memory" }, async () => {
  if (!lib) return;

  try {
    for (let i = 0; i < 10; i++) {
      await lib.render(SIMPLE_SVG, { width: 50, height: 50 });
    }
  } catch {
    // Expected during stub phase
  }
});

Deno.bench("Single large render", { group: "memory" }, async () => {
  if (!lib) return;

  try {
    await lib.render(SIMPLE_SVG, { width: 500, height: 500 });
  } catch {
    // Expected during stub phase
  }
});

// Benchmark: String vs Uint8Array input
Deno.bench("String SVG input", { group: "input-types" }, async () => {
  if (!lib) return;

  try {
    await lib.render(SIMPLE_SVG, { width: 100, height: 100 });
  } catch {
    // Expected during stub phase
  }
});

Deno.bench("Uint8Array SVG input", { group: "input-types" }, async () => {
  if (!lib) return;

  try {
    const svgBytes = new TextEncoder().encode(SIMPLE_SVG);
    await lib.render(svgBytes, { width: 100, height: 100 });
  } catch {
    // Expected during stub phase
  }
});

// Cleanup after benchmarks
globalThis.addEventListener("unload", () => {
  if (lib) {
    lib.destroy();
  }
});
