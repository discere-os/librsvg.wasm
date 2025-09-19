/**
 * LibRSVG WASM Benchmark - Performance testing with native Rust implementation
 *
 * Copyright (C) 2025 Superstruct Ltd, New Zealand
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */

import { createLibRSVG, LibRSVG } from "./lib/index.js";

interface BenchmarkResult {
  operation: string;
  svgComplexity: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  throughput: number;
  memoryUsage: number;
  renderTime: number;
}

/**
 * Comprehensive SVG performance benchmarks
 */
async function runBenchmarks() {
  console.log("🔥 LibRSVG WASM Performance Benchmarks");
  console.log("====================================");

  try {
    const rsvg = await createLibRSVG();
    console.log("✅ LibRSVG initialized");

    const capabilities = rsvg.getCapabilities();
    console.log(
      `🚀 SIMD Support: ${capabilities.simdSupport ? "Enabled" : "Disabled"}`,
    );
    console.log(
      `⚡ WebGPU Support: ${
        capabilities.webgpuSupport ? "Enabled" : "Disabled"
      }`,
    );

    const results: BenchmarkResult[] = [];

    // Test different SVG complexities
    const testComplexities = [
      { name: "Simple", svg: createSimpleSVG(), iterations: 50 },
      { name: "Medium", svg: createMediumSVG(), iterations: 20 },
      { name: "Complex", svg: createComplexSVG(), iterations: 10 },
      { name: "Very Complex", svg: createVeryComplexSVG(), iterations: 5 },
    ];

    for (const test of testComplexities) {
      console.log(`\n📊 Testing ${test.name} SVG complexity...`);

      // Get SVG info first
      const info = await rsvg.getImageInfo(test.svg);
      console.log(`  📏 Dimensions: ${info.width}x${info.height}`);
      console.log(`  📦 Elements: ${info.elementCount || "N/A"}`);

      // Benchmark rendering performance
      const renderStart = performance.now();
      const renderResults: number[] = [];

      for (let i = 0; i < test.iterations; i++) {
        const iterStart = performance.now();
        const rendered = await rsvg.render(test.svg, {
          colorspace: 0, // RGBA
          enableWebGPU: capabilities.webgpuSupport,
        });
        const iterTime = performance.now() - iterStart;
        renderResults.push(iterTime);

        if (i === 0) {
          // Verify first render
          console.log(
            `  🎨 First render: ${rendered.width}x${rendered.height}, ${rendered.data.length} bytes`,
          );
        }
      }

      const totalRenderTime = performance.now() - renderStart;
      const avgRenderTime = renderResults.reduce((a, b) => a + b, 0) /
        renderResults.length;
      const pixelsRendered = info.width * info.height * test.iterations;

      results.push({
        operation: `Render ${test.name}`,
        svgComplexity: test.name,
        iterations: test.iterations,
        totalTime: totalRenderTime,
        avgTime: avgRenderTime,
        throughput: pixelsRendered / (totalRenderTime / 1000),
        memoryUsage: test.svg.length,
        renderTime: avgRenderTime,
      });

      // Memory stress test
      console.log(
        `  🧠 Memory stress test (${test.iterations} concurrent renders)...`,
      );
      const memStart = performance.now();
      const promises = [];

      for (let i = 0; i < test.iterations; i++) {
        promises.push(rsvg.render(test.svg, {
          width: info.width,
          height: info.height,
        }));
      }

      await Promise.all(promises);
      const memTime = performance.now() - memStart;

      console.log(
        `  ⚡ Concurrent renders completed in ${memTime.toFixed(2)}ms`,
      );
      console.log(
        `  💾 Average time per render: ${
          (memTime / test.iterations).toFixed(2)
        }ms`,
      );
    }

    // Scale testing
    console.log(`\n📏 Scale Performance Testing...`);
    const scaleSVG = createMediumSVG();
    const baseInfo = await rsvg.getImageInfo(scaleSVG);

    const scaleTests = [
      { scale: 0.5, name: "50%" },
      { scale: 1.0, name: "100%" },
      { scale: 1.5, name: "150%" },
      { scale: 2.0, name: "200%" },
      { scale: 3.0, name: "300%" },
    ];

    for (const scaleTest of scaleTests) {
      const scaleStart = performance.now();
      const scaledWidth = Math.round(baseInfo.width * scaleTest.scale);
      const scaledHeight = Math.round(baseInfo.height * scaleTest.scale);

      const rendered = await rsvg.render(scaleSVG, {
        width: scaledWidth,
        height: scaledHeight,
        enableWebGPU: capabilities.webgpuSupport,
      });

      const scaleTime = performance.now() - scaleStart;

      results.push({
        operation: `Scale ${scaleTest.name}`,
        svgComplexity: "Medium",
        iterations: 1,
        totalTime: scaleTime,
        avgTime: scaleTime,
        throughput: (scaledWidth * scaledHeight) / (scaleTime / 1000),
        memoryUsage: rendered.data.length,
        renderTime: scaleTime,
      });

      console.log(
        `  📐 ${scaleTest.name}: ${scaledWidth}x${scaledHeight} in ${
          scaleTime.toFixed(2)
        }ms`,
      );
    }

    // Display results table
    console.log("\n📈 Benchmark Results:");
    console.log("================================================");
    console.table(results.map((r) => ({
      Operation: r.operation,
      Complexity: r.svgComplexity,
      "Avg Time (ms)": r.avgTime.toFixed(2),
      "Throughput (pixels/sec)": Math.round(r.throughput).toLocaleString(),
      "Memory (KB)": Math.round(r.memoryUsage / 1024),
      "Iterations": r.iterations,
    })));

    // Performance summary
    const metrics = rsvg.getPerformanceMetrics();
    console.log("\n🎯 Performance Summary:");
    console.log(`  SIMD Operations: ${metrics.simdUtilization}`);
    console.log(`  WebGPU Operations: ${metrics.webgpuUtilization}`);
    console.log(
      `  Total Memory Used: ${
        (metrics.memoryUsage / 1024 / 1024).toFixed(2)
      }MB`,
    );
    console.log(`  Average Render Time: ${metrics.renderTime.toFixed(2)}ms`);

    // Browser performance context
    console.log("\n🌐 Browser Context:");
    console.log(`  User Agent: ${navigator.userAgent}`);
    console.log(
      `  Hardware Concurrency: ${navigator.hardwareConcurrency || "Unknown"}`,
    );
    console.log(`  Memory: ${(navigator as any).deviceMemory || "Unknown"}GB`);

    rsvg.destroy();
    console.log("\n✅ Benchmarks completed successfully!");
  } catch (error) {
    console.error("\n❌ Benchmark failed:", (error as Error).message);
  }
}

/**
 * Create simple SVG for basic performance testing
 */
function createSimpleSVG(): string {
  return `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="50" fill="blue"/>
      <rect x="50" y="50" width="100" height="100" fill="red" opacity="0.5"/>
    </svg>
  `;
}

/**
 * Create medium complexity SVG
 */
function createMediumSVG(): string {
  const shapes: string[] = [];

  // Add gradients
  shapes.push(`
    <defs>
      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff7f7f"/>
        <stop offset="100%" stop-color="#7f7fff"/>
      </linearGradient>
      <radialGradient id="grad2" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffff7f"/>
        <stop offset="100%" stop-color="#7fff7f"/>
      </radialGradient>
    </defs>
  `);

  // Add various shapes
  for (let i = 0; i < 20; i++) {
    const x = (i % 5) * 80 + 40;
    const y = Math.floor(i / 5) * 80 + 40;
    const fill = i % 2 === 0 ? "url(#grad1)" : "url(#grad2)";

    if (i % 3 === 0) {
      shapes.push(`<circle cx="${x}" cy="${y}" r="25" fill="${fill}"/>`);
    } else if (i % 3 === 1) {
      shapes.push(
        `<rect x="${x - 20}" y="${
          y - 20
        }" width="40" height="40" fill="${fill}"/>`,
      );
    } else {
      shapes.push(
        `<polygon points="${x - 20},${y + 20} ${x},${y - 20} ${x + 20},${
          y + 20
        }" fill="${fill}"/>`,
      );
    }
  }

  return `
    <svg width="400" height="320" xmlns="http://www.w3.org/2000/svg">
      ${shapes.join("\n")}
    </svg>
  `;
}

/**
 * Create complex SVG with many elements
 */
function createComplexSVG(): string {
  const elements: string[] = [];

  // Complex gradient definitions
  elements.push(`
    <defs>
      <linearGradient id="complex1" gradientTransform="rotate(45)">
        <stop offset="0%" stop-color="#ff0000"/>
        <stop offset="25%" stop-color="#ffff00"/>
        <stop offset="50%" stop-color="#00ff00"/>
        <stop offset="75%" stop-color="#0000ff"/>
        <stop offset="100%" stop-color="#ff00ff"/>
      </linearGradient>
      <filter id="blur">
        <feGaussianBlur stdDeviation="2"/>
      </filter>
    </defs>
  `);

  // Many overlapping shapes
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * 500;
    const y = Math.random() * 400;
    const size = Math.random() * 20 + 5;

    elements.push(`
      <circle cx="${x}" cy="${y}" r="${size}"
              fill="url(#complex1)"
              opacity="0.3"
              filter="url(#blur)"/>
    `);
  }

  // Complex paths
  for (let i = 0; i < 50; i++) {
    const pathData = generateComplexPath();
    elements.push(`
      <path d="${pathData}"
            stroke="url(#complex1)"
            stroke-width="2"
            fill="none"
            opacity="0.5"/>
    `);
  }

  return `
    <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
      ${elements.join("\n")}
    </svg>
  `;
}

/**
 * Create very complex SVG for stress testing
 */
function createVeryComplexSVG(): string {
  const elements: string[] = [];

  // Many filters and effects
  elements.push(`
    <defs>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="3" dy="3" stdDeviation="3" flood-opacity="0.5"/>
      </filter>
      <pattern id="pattern1" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#f0f0f0"/>
        <circle cx="10" cy="10" r="5" fill="#333"/>
      </pattern>
    </defs>
  `);

  // Thousands of small elements
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 800;
    const y = Math.random() * 600;
    const hue = (i * 137.5) % 360; // Golden angle for color distribution

    elements.push(`
      <rect x="${x}" y="${y}" width="10" height="10"
            fill="hsl(${hue}, 70%, 60%)"
            opacity="0.8"
            filter="url(#shadow)"
            transform="rotate(${i % 360} ${x + 5} ${y + 5})"/>
    `);
  }

  return `
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      ${elements.join("\n")}
    </svg>
  `;
}

/**
 * Generate complex path data
 */
function generateComplexPath(): string {
  const commands = [];
  let x = Math.random() * 500;
  let y = Math.random() * 400;

  commands.push(`M${x},${y}`);

  for (let i = 0; i < 10; i++) {
    const dx = (Math.random() - 0.5) * 100;
    const dy = (Math.random() - 0.5) * 100;

    if (Math.random() < 0.3) {
      // Curve
      const cp1x = x + (Math.random() - 0.5) * 50;
      const cp1y = y + (Math.random() - 0.5) * 50;
      const cp2x = x + dx * 0.5;
      const cp2y = y + dy * 0.5;
      x += dx;
      y += dy;
      commands.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`);
    } else {
      // Line
      x += dx;
      y += dy;
      commands.push(`L${x},${y}`);
    }
  }

  return commands.join(" ");
}

// Run benchmarks
if (typeof window !== "undefined") {
  window.addEventListener("load", runBenchmarks);
} else {
  runBenchmarks().catch(console.error);
}
