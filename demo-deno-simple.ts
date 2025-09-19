#!/usr/bin/env deno
/**
 * LibRSVG.wasm Simple Demo - Quick start example
 */

import LibRSVG from "./src/lib/index.ts"

// Simple SVG for testing
const SIMPLE_SVG = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="red"/>
  <circle cx="50" cy="50" r="30" fill="blue"/>
</svg>`

async function simpleDemo() {
  console.log("🎨 LibRSVG.wasm Simple Demo")

  // Create and initialize the library
  const librsvg = new LibRSVG()

  try {
    console.log("Initializing...")
    await librsvg.initialize()

    console.log("Rendering SVG...")
    const result = await librsvg.render(SIMPLE_SVG)

    console.log(`✅ Success! Rendered ${result.width}×${result.height} image`)
    console.log(`   Data size: ${result.data.length} bytes`)
    console.log(`   Render time: ${result.renderTime.toFixed(2)}ms`)

  } catch (error) {
    console.log(`❌ Expected error (no WASM built yet): ${error.message}`)
    console.log("Run: deno task build:wasm")
  } finally {
    librsvg.destroy()
  }
}

if (import.meta.main) {
  simpleDemo()
}