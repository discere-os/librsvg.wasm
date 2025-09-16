/**
 * LibRSVG WASM Demo - SVG rendering with WebGPU acceleration
 * Demonstrates native Rust SVG functionality via minimal TypeScript bindings
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

import { LibRSVG, SVGColorspace, createLibRSVG } from './lib/index.js'

/**
 * Demo: SVG rendering with performance metrics
 */
async function svgDemo() {
  console.log('🔥 LibRSVG WASM Demo - Native-Level SVG Processing')
  console.log('===============================================')

  try {
    // Initialize LibRSVG with maximum browser features
    const rsvg = await createLibRSVG({
      cdnUrl: 'https://cdn.discere.cloud/npm/@discere-os/librsvg.wasm/',
      maxFileSizeMB: 50
    })

    console.log('✅ LibRSVG initialized successfully')

    // Display capabilities
    const capabilities = rsvg.getCapabilities()
    console.log('\n📊 SVG Capabilities:')
    console.log(`  SIMD Support: ${capabilities.simdSupport ? '✅' : '❌'}`)
    console.log(`  WebGPU: ${capabilities.webgpuSupport ? '✅' : '❌'}`)
    console.log(`  Cairo Version: ${capabilities.cairoVersion}`)
    console.log(`  LibRSVG Version: ${capabilities.librsvgVersion}`)
    console.log(`  Max Image Size: ${capabilities.maxImageSize}x${capabilities.maxImageSize}`)

    // Create test SVG documents
    const testSVGs = [
      // Simple geometric shapes
      `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
         <circle cx="100" cy="100" r="50" fill="red" stroke="black" stroke-width="2"/>
       </svg>`,

      // Complex gradient
      `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
         <defs>
           <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
             <stop offset="0%" stop-color="rgb(255,255,0)" />
             <stop offset="100%" stop-color="rgb(255,0,0)" />
           </linearGradient>
         </defs>
         <ellipse cx="150" cy="100" rx="100" ry="50" fill="url(#grad)" />
       </svg>`,

      // Text with transformations
      `<svg width="400" height="150" xmlns="http://www.w3.org/2000/svg">
         <text x="50" y="50" font-family="Arial" font-size="20" fill="blue">
           Hello SVG World!
         </text>
         <text x="50" y="100" font-family="serif" font-size="16" fill="green"
               transform="rotate(15 50,100)">Rotated Text</text>
       </svg>`,

      // Complex path data
      `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
         <path d="M150,50 Q50,150 150,250 Q250,150 150,50 Z"
               fill="purple" stroke="orange" stroke-width="3"/>
       </svg>`
    ]

    // Test different rendering configurations
    const renderConfigs = [
      { name: 'Standard', options: {} },
      { name: 'High DPI', options: { dpi: 150, scale: 1.5 } },
      { name: 'Large Scale', options: { width: 800, height: 600 } },
      { name: 'WebGPU (if available)', options: { enableWebGPU: true } }
    ]

    for (let i = 0; i < testSVGs.length; i++) {
      console.log(`\n🎨 Testing SVG ${i + 1}...`)

      // Get SVG information first
      const info = await rsvg.getImageInfo(testSVGs[i])
      console.log(`  📏 Dimensions: ${info.width}x${info.height}`)
      console.log(`  📦 ViewBox: ${info.viewBoxWidth}x${info.viewBoxHeight}`)

      // Test different rendering configurations
      for (const config of renderConfigs) {
        console.log(`\n  🔧 ${config.name} rendering...`)

        const startTime = performance.now()

        try {
          // Render SVG using native Rust implementation
          const rendered = await rsvg.render(testSVGs[i], config.options)
          const renderTime = performance.now() - startTime

          console.log(`    ⚡ Rendered in ${renderTime.toFixed(2)}ms`)
          console.log(`    🖼️  Output: ${rendered.width}x${rendered.height}`)
          console.log(`    📦 Size: ${rendered.data.length} bytes`)
          console.log(`    🎯 Stride: ${rendered.stride}`)
          console.log(`    💾 Memory: ${(rendered.memoryUsage / 1024).toFixed(1)}KB`)

          // Verify pixel data integrity
          if (rendered.data.length !== rendered.width * rendered.height * 4) {
            throw new Error('Rendered data size mismatch')
          }

          // Sample some pixel values to verify rendering
          const samplePixel = {
            r: rendered.data[0],
            g: rendered.data[1],
            b: rendered.data[2],
            a: rendered.data[3]
          }
          console.log(`    🎨 Sample pixel: RGBA(${samplePixel.r},${samplePixel.g},${samplePixel.b},${samplePixel.a})`)

        } catch (error) {
          console.log(`    ❌ Rendering failed: ${(error as Error).message}`)
        }
      }
    }

    // Test error handling with invalid SVG
    console.log(`\n🧪 Testing error handling...`)
    try {
      await rsvg.render('<invalid-svg>not valid</invalid-svg>')
    } catch (error) {
      console.log(`  ✅ Error correctly caught: ${(error as Error).message}`)
    }

    // Display final performance metrics
    const metrics = rsvg.getPerformanceMetrics()
    console.log(`\n📈 Performance Summary:`)
    console.log(`  Average parse time: ${metrics.parseTime.toFixed(2)}ms`)
    console.log(`  Average render time: ${metrics.renderTime.toFixed(2)}ms`)
    console.log(`  Total memory usage: ${(metrics.memoryUsage / 1024).toFixed(1)}KB`)
    console.log(`  SIMD operations: ${metrics.simdUtilization}`)
    console.log(`  WebGPU operations: ${metrics.webgpuUtilization}`)

    // Cleanup
    rsvg.destroy()
    console.log('\n✅ Demo completed successfully!')

  } catch (error) {
    console.error('\n❌ Demo failed:', (error as Error).message)
    console.error(error)
  }
}

/**
 * Create test patterns for performance benchmarking
 */
function createComplexSVG(width: number, height: number): string {
  const elements: string[] = []

  // Background gradient
  elements.push(`
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e3c72"/>
        <stop offset="100%" stop-color="#2a5298"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
  `)

  // Random geometric shapes
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * width
    const y = Math.random() * height
    const radius = Math.random() * 30 + 10
    const color = `hsl(${Math.random() * 360}, 70%, 60%)`

    elements.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" opacity="0.8"/>`)
  }

  // Complex paths
  for (let i = 0; i < 10; i++) {
    const startX = Math.random() * width
    const startY = Math.random() * height
    const endX = Math.random() * width
    const endY = Math.random() * height
    const cp1X = Math.random() * width
    const cp1Y = Math.random() * height
    const cp2X = Math.random() * width
    const cp2Y = Math.random() * height

    elements.push(`
      <path d="M${startX},${startY} C${cp1X},${cp1Y} ${cp2X},${cp2Y} ${endX},${endY}"
            stroke="white" stroke-width="2" fill="none" opacity="0.6"/>
    `)
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${elements.join('\n')}
    </svg>
  `
}

/**
 * Browser compatibility check
 */
function checkBrowserCompatibility(): boolean {
  const requirements = {
    webAssembly: typeof WebAssembly !== 'undefined',
    simd: typeof (WebAssembly as any).simd !== 'undefined',
    // Note: We target WebGPU+SIMD browsers only
    webGPU: typeof navigator !== 'undefined' && 'gpu' in navigator
  }

  console.log('🌐 Browser Compatibility Check:')
  console.log(`  WebAssembly: ${requirements.webAssembly ? '✅' : '❌'}`)
  console.log(`  WASM SIMD: ${requirements.simd ? '✅' : '❌'}`)
  console.log(`  WebGPU: ${requirements.webGPU ? '✅' : '❌'}`)

  const compatible = requirements.webAssembly && requirements.simd

  if (!compatible) {
    console.log('\n⚠️  Please upgrade to Chrome/Edge 113+ for full native-level performance')
  }

  return compatible
}

// Run demo when module loads
if (typeof window !== 'undefined') {
  // Browser environment
  window.addEventListener('load', async () => {
    if (checkBrowserCompatibility()) {
      await svgDemo()
    }
  })
} else if (typeof process !== 'undefined') {
  // Node.js environment
  svgDemo().catch(console.error)
}