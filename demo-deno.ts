#!/usr/bin/env deno
/**
 * LibRSVG.wasm Demo - Deno-first SVG rendering demonstration
 *
 * Comprehensive demonstration of SVG parsing, rendering, and WebGPU acceleration
 */

import LibRSVG from "./src/lib/index.ts"
import { SVGColorspace, SVGAspectRatio } from "./src/lib/types.ts"

// Sample SVG data for testing
const SAMPLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="300" height="200" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="300" height="200" fill="url(#grad1)" />
  <circle cx="150" cy="100" r="50" fill="blue" opacity="0.7" />
  <text x="150" y="180" font-family="Arial" font-size="20" text-anchor="middle" fill="white">
    LibRSVG.wasm Demo
  </text>
</svg>`

const COMPLEX_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="radial" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:white;stop-opacity:1" />
      <stop offset="100%" style="stop-color:black;stop-opacity:1" />
    </radialGradient>
    <filter id="blur" x="0" y="0">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="400" height="400" fill="url(#radial)" />

  <!-- Multiple geometric shapes -->
  <g transform="translate(200,200)">
    <polygon points="-50,-50 50,-50 100,0 50,50 -50,50 -100,0"
             fill="rgba(255,100,100,0.8)"
             stroke="darkred"
             stroke-width="2" />
    <circle r="30" fill="rgba(100,255,100,0.8)" stroke="darkgreen" stroke-width="2" />
    <rect x="-15" y="-15" width="30" height="30"
          fill="rgba(100,100,255,0.8)"
          stroke="darkblue"
          stroke-width="2" />
  </g>

  <!-- Text with effects -->
  <text x="200" y="350" font-family="Arial Black" font-size="24"
        text-anchor="middle" fill="white" filter="url(#blur)">
    Complex SVG Rendering
  </text>
</svg>`

async function demoBasicRendering() {
  console.log("🎨 LibRSVG.wasm Basic Rendering Demo")
  console.log("=====================================")

  const librsvg = new LibRSVG({
    timeout: 10000,
    retryCount: 2
  })

  try {
    console.log("📦 Initializing librsvg.wasm...")
    await librsvg.initialize()
    console.log("✅ Library initialized successfully!")

    // Get capabilities
    const caps = librsvg.getCapabilities()
    console.log(`🔧 Capabilities:`)
    console.log(`   SIMD Support: ${caps.simdSupport}`)
    console.log(`   WebGPU Support: ${caps.webgpuSupport}`)
    console.log(`   LibRSVG Version: ${caps.librsvgVersion}`)
    console.log(`   Cairo Version: ${caps.cairoVersion}`)
    console.log(`   Max Image Size: ${caps.maxImageSize}px`)

    // Get SVG information
    console.log("\\n📏 Analyzing SVG document...")
    const info = await librsvg.getImageInfo(SAMPLE_SVG)
    console.log(`   Dimensions: ${info.width} × ${info.height}`)
    console.log(`   ViewBox: ${info.viewBoxWidth} × ${info.viewBoxHeight}`)
    console.log(`   Elements: ${info.elementCount}`)
    console.log(`   Paths: ${info.pathCount}`)
    console.log(`   Animation: ${info.hasAnimation}`)

    // Render SVG to RGBA pixels
    console.log("\\n🖼️ Rendering SVG to RGBA pixels...")
    const startTime = performance.now()

    const result = await librsvg.render(SAMPLE_SVG, {
      width: 300,
      height: 200,
      dpi: 96,
      colorspace: SVGColorspace.RGBA,
      aspectRatio: SVGAspectRatio.MEET,
      enableAntialiasing: true,
      enableWebGPU: caps.webgpuSupport
    })

    const renderTime = performance.now() - startTime
    console.log(`✅ Rendering completed in ${renderTime.toFixed(2)}ms`)
    console.log(`   Output size: ${result.width} × ${result.height}`)
    console.log(`   Pixel data: ${result.data.length} bytes`)
    console.log(`   Memory usage: ${(result.memoryUsage / 1024).toFixed(1)}KB`)
    console.log(`   Stride: ${result.stride} bytes/row`)

    // Sample pixel values
    const samplePixels = Array.from(result.data.slice(0, 12))
      .map(v => v.toString().padStart(3, ' '))
      .join(', ')
    console.log(`   First 3 pixels (RGBA): [${samplePixels}]`)

  } catch (error) {
    console.error("❌ Demo failed:", error.message)
    console.log("ℹ️  This is expected if WASM modules are not built yet")
    console.log("   Run: deno task build:wasm")
  } finally {
    librsvg.destroy()
  }
}

async function demoPerformanceComparison() {
  console.log("\\n⚡ Performance Comparison Demo")
  console.log("===============================")

  const librsvg = new LibRSVG()

  try {
    await librsvg.initialize()

    const iterations = 5
    const renderTimes: number[] = []

    console.log(`Running ${iterations} rendering iterations...`)

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()

      await librsvg.render(COMPLEX_SVG, {
        width: 400,
        height: 400,
        enableWebGPU: false // Compare CPU vs GPU later
      })

      const renderTime = performance.now() - startTime
      renderTimes.push(renderTime)
      console.log(`  Iteration ${i + 1}: ${renderTime.toFixed(2)}ms`)
    }

    const avgTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
    const minTime = Math.min(...renderTimes)
    const maxTime = Math.max(...renderTimes)

    console.log(`\\n📊 Performance Results:`)
    console.log(`   Average: ${avgTime.toFixed(2)}ms`)
    console.log(`   Minimum: ${minTime.toFixed(2)}ms`)
    console.log(`   Maximum: ${maxTime.toFixed(2)}ms`)
    console.log(`   Throughput: ${(1000 / avgTime).toFixed(1)} renders/second`)

    // Show performance metrics
    const metrics = librsvg.getPerformanceMetrics()
    console.log(`\\n🔍 Cumulative Metrics:`)
    console.log(`   Parse time: ${metrics.parseTime.toFixed(2)}ms`)
    console.log(`   Render time: ${metrics.renderTime.toFixed(2)}ms`)
    console.log(`   Memory usage: ${(metrics.memoryUsage / 1024).toFixed(1)}KB`)
    console.log(`   SIMD utilization: ${metrics.simdUtilization}`)
    console.log(`   WebGPU utilization: ${metrics.webgpuUtilization}`)

  } catch (error) {
    console.error("❌ Performance demo failed:", error.message)
  } finally {
    librsvg.destroy()
  }
}

async function demoErrorHandling() {
  console.log("\\n🚨 Error Handling Demo")
  console.log("========================")

  const librsvg = new LibRSVG()

  try {
    await librsvg.initialize()

    // Test invalid SVG
    console.log("Testing invalid SVG data...")
    try {
      await librsvg.render("This is not valid SVG")
      console.log("❌ Should have failed with invalid SVG")
    } catch (error) {
      console.log(`✅ Correctly caught error: ${error.message}`)
    }

    // Test empty SVG
    console.log("\\nTesting empty SVG data...")
    try {
      await librsvg.render("")
      console.log("❌ Should have failed with empty SVG")
    } catch (error) {
      console.log(`✅ Correctly caught error: ${error.message}`)
    }

    // Test extremely large dimensions
    console.log("\\nTesting extreme dimensions...")
    try {
      await librsvg.render(SAMPLE_SVG, {
        width: 100000,
        height: 100000
      })
      console.log("❌ Should have failed with extreme dimensions")
    } catch (error) {
      console.log(`✅ Correctly caught error: ${error.message}`)
    }

  } catch (error) {
    console.error("❌ Error handling demo setup failed:", error.message)
  } finally {
    librsvg.destroy()
  }
}

async function demoColorspaceConversion() {
  console.log("\\n🌈 Colorspace Conversion Demo")
  console.log("===============================")

  const librsvg = new LibRSVG()

  try {
    await librsvg.initialize()

    const colorspaces = [
      { name: "RGBA", format: SVGColorspace.RGBA },
      { name: "BGRA", format: SVGColorspace.BGRA },
      { name: "RGB", format: SVGColorspace.RGB }
    ]

    for (const cs of colorspaces) {
      console.log(`\\nRendering with ${cs.name} colorspace...`)

      const result = await librsvg.render(SAMPLE_SVG, {
        width: 100,
        height: 100,
        colorspace: cs.format
      })

      const bytesPerPixel = cs.name === 'RGB' ? 3 : 4
      const expectedSize = 100 * 100 * bytesPerPixel

      console.log(`   Expected size: ${expectedSize} bytes`)
      console.log(`   Actual size: ${result.data.length} bytes`)
      console.log(`   Match: ${result.data.length === expectedSize ? '✅' : '❌'}`)

      // Show first few pixel values
      const pixels = Array.from(result.data.slice(0, bytesPerPixel * 2))
        .map(v => v.toString().padStart(3, ' '))
      console.log(`   First 2 pixels: [${pixels.join(', ')}]`)
    }

  } catch (error) {
    console.error("❌ Colorspace demo failed:", error.message)
  } finally {
    librsvg.destroy()
  }
}

// Main demo execution
async function main() {
  console.log("LibRSVG.wasm Comprehensive Demo")
  console.log("===============================")
  console.log(`Deno version: ${Deno.version.deno}`)
  console.log(`Platform: ${Deno.build.os} ${Deno.build.arch}`)
  console.log(`Started: ${new Date().toISOString()}`)

  await demoBasicRendering()
  await demoPerformanceComparison()
  await demoErrorHandling()
  await demoColorspaceConversion()

  console.log("\\n🎉 Demo completed!")
}

// Run if this is the main module
if (import.meta.main) {
  main().catch(console.error)
}