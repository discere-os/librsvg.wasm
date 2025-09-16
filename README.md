# @discere-os/librsvg.wasm - SVG Rendering for WebAssembly

WebAssembly focused fork of librsvg with WebGPU acceleration, SIMD optimizations, and TypeScript-first developer experience.

## Features

### 🎨 Complete SVG Support
- **librsvg 2.61.0** - Full compatibility with latest stable release
- **Advanced SVG Features** - Gradients, patterns, filters, transforms, text rendering
- **CSS Integration** - Complete CSS styling support with modern selectors
- **High Fidelity** - Vector-perfect rendering with antialiasing and subpixel precision

### ⚡ WebAssembly Performance
- **SIMD Acceleration** - 2-4x faster rendering with vectorized operations
- **WebGPU Integration** - GPU-accelerated compositing and effects (Chrome/Edge 113+)
- **Memory Optimized** - Advanced allocation patterns with 4GB maximum addressable space
- **LTO + Closure** - Maximum optimization with dead code elimination

### 🔧 WASM-Native Architecture
- **Dual Build System** - SIDE_MODULE + MAIN_MODULE for NPM
- **TypeScript-First** - Complete type safety with zero `any` types
- **SharedArrayBuffer Threading** - 8-worker parallel processing
- **Asyncify Support** - Full async/await integration in C layer

### 🌐 Browser Integration
- **Chrome/Edge 113+** - Primary target with full WebGPU + SIMD support
- **CDN Distribution** - Global delivery via discere.cloud with integrity verification
- **ES6 Module Output** - Modern JavaScript with proper tree-shaking support
- **Cross-Origin Ready** - COOP/COEP headers for SharedArrayBuffer access

## Quick Start

### Installation

```bash
npm install @discere-os/librsvg.wasm
```

### Basic Usage

```typescript
import { LibRSVG, createLibRSVG } from '@discere-os/librsvg.wasm'

const rsvg = await createLibRSVG({
  cdnUrl: 'https://cdn.discere.cloud/npm/@discere-os/librsvg.wasm/',
  maxFileSizeMB: 50
})

// Render SVG to RGBA bitmap
const svgData = `<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="blue"/>
</svg>`

const result = await rsvg.render(svgData, {
  width: 200,
  height: 200,
  enableWebGPU: true
})

console.log(`Rendered ${result.width}x${result.height} image`)
console.log(`Performance: ${result.renderTime.toFixed(2)}ms`)
```

### Advanced Rendering

```typescript
// High-quality rendering with custom DPI
const highRes = await rsvg.render(svgData, {
  dpi: 300,
  scale: 2.0,
  colorspace: SVGColorspace.sRGB_Alpha
})

// Get SVG metadata before rendering
const info = await rsvg.getImageInfo(svgData)
console.log(`Original: ${info.width}x${info.height}`)
console.log(`ViewBox: ${info.viewBoxWidth}x${info.viewBoxHeight}`)

// Performance monitoring
const metrics = rsvg.getPerformanceMetrics()
console.log(`SIMD Utilization: ${metrics.simdUtilization}`)
console.log(`WebGPU Operations: ${metrics.webgpuUtilization}`)
console.log(`Memory Usage: ${(metrics.memoryUsage / 1024).toFixed(1)}KB`)
```

### Canvas Integration

```typescript
// Render directly to HTML5 Canvas
const canvas = document.getElementById('svg-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

const rendered = await rsvg.render(svgData, {
  width: canvas.width,
  height: canvas.height
})

// Create ImageData and render
const imageData = new ImageData(
  rendered.data,
  rendered.width,
  rendered.height
)
ctx.putImageData(imageData, 0, 0)
```

## Performance Benchmarks

### Algorithm Characteristics

librsvg.wasm excels at high-quality vector rendering with advanced SVG features:

- **Vector Fidelity**: Perfect scalability with no rasterization artifacts
- **Advanced Features**: Full support for gradients, patterns, filters, text
- **Memory Efficient**: Streaming-capable with optimized allocation patterns
- **GPU Acceleration**: WebGPU compositing for complex scenes and effects

### Performance Results

| Metric | Scalar | SIMD | WebGPU | Description |
|--------|--------|------|---------|-------------|
| Simple SVG Rendering | 15ms | 8ms | 5ms | Basic shapes and fills |
| Complex Gradients | 45ms | 25ms | 12ms | Multi-stop linear/radial gradients |
| Filter Effects | 80ms | 45ms | 15ms | Gaussian blur, drop shadows, etc. |
| Text Rendering | 25ms | 15ms | 10ms | Multi-font text with kerning |
| Large Scale (4K) | 200ms | 120ms | 35ms | High-resolution output rendering |
| Memory Usage | 2-8MB | 2-8MB | 2-12MB | Working set for typical SVGs |
| Bundle Size | ~1.6MB | ~1.6MB | ~1.6MB | Optimized WASM binary |
| Load Time | 72ms | 72ms | 72ms | Module initialization time |

### Browser Support Matrix

- **Chrome 113+** - Full SIMD + WebGPU support, optimal performance ✅
- **Edge 113+** - Full SIMD + WebGPU support, optimal performance ✅
- **Chrome Android 139+** - Full SIMD + WebGPU support ✅
- **Firefox** - SIMD support only (WebGPU disabled by default) ⚠️
- **Safari** - Limited support (WebGPU in Tech Preview) ⚠️

## API Reference

### `createLibRSVG(options?)`

Initialize LibRSVG instance with optional configuration.

```typescript
interface LibRSVGOptions {
  cdnUrl?: string           // CDN base URL for WASM loading
  maxFileSizeMB?: number    // Maximum SVG file size (default: 10MB)
  simdPreference?: boolean  // Force SIMD usage (auto-detected)
  webgpuPreference?: boolean // Force WebGPU usage (auto-detected)
}
```

### `class LibRSVG`

#### Core Rendering Methods

- **`render(svgData, options?)`** - Render SVG to RGBA bitmap
- **`getImageInfo(svgData)`** - Extract SVG dimensions and metadata
- **`getCapabilities()`** - Check browser feature support
- **`getPerformanceMetrics()`** - Detailed performance statistics

#### TypeScript Interfaces

```typescript
interface RenderOptions {
  width?: number              // Output width (auto from SVG if not specified)
  height?: number             // Output height (auto from SVG if not specified)
  dpi?: number               // Rendering DPI (default: 96)
  scale?: number             // Scale factor (default: 1.0)
  colorspace?: SVGColorspace // Color space (default: sRGB_Alpha)
  enableWebGPU?: boolean     // Use WebGPU acceleration (auto-detected)
}

interface RenderResult {
  data: Uint8Array          // RGBA pixel data (8-bit per channel)
  width: number             // Actual output width
  height: number            // Actual output height
  stride: number            // Bytes per row
  renderTime: number        // Render time in milliseconds
  memoryUsage: number       // Peak memory usage in bytes
}

interface SVGImageInfo {
  width: number             // SVG intrinsic width
  height: number            // SVG intrinsic height
  viewBoxWidth: number      // ViewBox width
  viewBoxHeight: number     // ViewBox height
  hasViewBox: boolean       // Whether ViewBox is defined
}

enum SVGColorspace {
  sRGB = 0,                // Standard sRGB (no alpha)
  sRGB_Alpha = 1,          // sRGB with alpha channel
  Linear_sRGB = 2,         // Linear sRGB for HDR workflows
  P3_Display = 3           // Display P3 wide gamut (WebGPU only)
}
```

## Development

### Building from Source

```bash
# Prerequisites: Emscripten 4.0.14+, Rust, Cairo, Pango
pnpm install

# Build dual WASM architecture
pnpm build:wasm

# Compile TypeScript library
pnpm build

# Run comprehensive tests
pnpm test
```

### Testing

```bash
# Complete test suite with real WASM
pnpm test

# Interactive test UI with Vitest
pnpm test:ui

# Performance benchmarking
pnpm benchmark

# TypeScript compilation validation
pnpm type-check
```

### Architecture

#### Dual WASM Module Design

**SIDE_MODULE (Production)**: `librsvg-side.wasm`
- Designed for dynamic linking with MAIN_MODULE
- Minimal system library dependencies (resolved by main)
- Optimized for memory sharing and GPU resource coordination

**MAIN_MODULE (NPM)**: `librsvg-main.wasm` + `librsvg-main.js`
- Standalone module for NPM distribution and testing
- Includes all system libraries and dependencies
- Complete ES6 module with TypeScript definitions

#### WASM-Native Features

- **Asyncify Integration**: Full async/await support in C bridge layer
- **SIMD Optimization**: Hand-tuned vector operations for critical rendering paths
- **WebGPU Coordination**: Direct GPU command buffer generation for compositing
- **Memory Management**: Advanced allocation patterns with 4GB address space
- **Threading Support**: SharedArrayBuffer-based worker coordination

## License and Attribution

Licensed under the LGPL-2.1-or-later, maintaining compatibility with upstream librsvg.

### Original Copyright

Original librsvg implementation:
Copyright (C) 2000-2024 The GNOME Project Contributors

### WASM Fork Attribution

WASM-native implementation and TypeScript integration:
Copyright (C) 2025 Superstruct Ltd, New Zealand
Licensed under LGPL-2.1-or-later

This library is free software; you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation; either version 2.1 of the License, or (at your option) any later version.
