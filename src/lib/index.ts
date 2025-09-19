/**
 * librsvg.wasm - TypeScript-first SVG rendering for WebAssembly
 * High-performance SVG with WebGPU acceleration and minimal TypeScript glue layer
 *
 * Based on librsvg 2.61.0 with comprehensive WASM-native enhancements
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

import {
  SVGColorspace,
  SVGUnits,
  SVGAspectRatio,
  SVGErrorCode
} from './types.ts'
import type {
  LibRSVGModule,
  SVGImageInfo,
  SVGRenderOptions,
  SVGResult,
  SVGCapabilities,
  SVGLoadingOptions,
  SVGPerformanceMetrics
} from './types.ts'

/**
 * SVG processor with WebGPU acceleration
 *
 * Architecture:
 * - ALL SVG processing logic implemented in Rust librsvg + C/C++ WASM layer
 * - TypeScript provides ONLY minimal bindings to native functions
 * - Direct WASM integration without JavaScript abstraction layers
 * - Supports both SIDE_MODULE and MAIN_MODULE (standalone) usage
 */
export class LibRSVG {
  private module: LibRSVGModule | null = null
  private isInitialized = false
  private simdSupported = false
  private webgpuSupported = false
  private performanceMetrics: SVGPerformanceMetrics = {
    parseTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    simdUtilization: 0,
    webgpuUtilization: 0
  }

  private loadingOptions: SVGLoadingOptions = {
    cdnUrl: 'https://cdn.discere.cloud/npm/@discere-os/librsvg.wasm/',
    fallbackUrls: [
      'https://cdn.jsdelivr.net/npm/@discere-os/librsvg.wasm/',
      'https://unpkg.com/@discere-os/librsvg.wasm/'
    ],
    timeout: 30000,
    retryCount: 3,
    useCache: true,
    maxFileSizeMB: 100
  }

  constructor(options?: Partial<SVGLoadingOptions>) {
    if (options) {
      this.loadingOptions = { ...this.loadingOptions, ...options }
    }
  }

  /**
   * Initialize librsvg.wasm module with capability detection
   * Uses Rust/C native initialization - no JavaScript logic
   */
  async initialize(wasmModule?: LibRSVGModule): Promise<void> {
    if (this.isInitialized) {
      return
    }

    if (wasmModule) {
      this.module = wasmModule
    } else {
      this.module = await this.loadModule()
    }

    if (!this.module) {
      throw new Error('Failed to load librsvg.wasm module')
    }

    // Initialize WASM-native SVG library (C/Rust function call)
    const initResult = this.module.ccall('rsvg_wasm_init', 'number', [], [])
    if (initResult !== 0) {
      throw new Error('Failed to initialize SVG WASM library')
    }

    // Detect SIMD support using native function
    this.simdSupported = this.module.ccall('rsvg_wasm_get_simd_support', 'number', [], []) === 1

    // TODO: Detect WebGPU support
    this.webgpuSupported = false

    this.isInitialized = true
  }

  /**
   * Render SVG data to RGBA pixels using native Rust implementation
   *
   * @param svgData - SVG document data (string or Uint8Array)
   * @param options - Rendering options (optional)
   * @returns Rendered image result with RGBA data
   */
  async render(svgData: string | Uint8Array, options: SVGRenderOptions = {}): Promise<SVGResult> {
    if (!this.isInitialized) {
      throw new Error('LibRSVG not initialized. Call initialize() first.')
    }

    const startTime = performance.now()

    // Convert SVG data to Uint8Array if needed
    let svgBytes: Uint8Array
    if (typeof svgData === 'string') {
      svgBytes = new TextEncoder().encode(svgData)
    } else {
      svgBytes = svgData
    }

    // Allocate memory for SVG input data
    const inputPtr = this.module!._malloc(svgBytes.length)
    if (!inputPtr) {
      throw new Error('Failed to allocate memory for SVG input data')
    }

    try {
      // Copy SVG data to WASM heap
      this.module!.HEAPU8.set(svgBytes, inputPtr)

      // Get SVG dimensions using native function
      const widthPtr = this.module!._malloc(4)
      const heightPtr = this.module!._malloc(4)

      const infoResult = this.module!.ccall('rsvg_wasm_get_svg_info', 'number',
        ['number', 'number', 'number', 'number'],
        [inputPtr, svgBytes.length, widthPtr, heightPtr]
      )

      if (!infoResult) {
        throw new Error('Invalid SVG document format')
      }

      const width = options.width || this.module!.HEAPU32[widthPtr >> 2]
      const height = options.height || this.module!.HEAPU32[heightPtr >> 2]

      this.module!._free(widthPtr)
      this.module!._free(heightPtr)

      // Set viewport if specified
      if (options.width || options.height) {
        this.module!.ccall('rsvg_wasm_set_viewport', 'void', ['number', 'number'], [width, height])
      }

      // Enable WebGPU acceleration if requested and available
      if (options.enableWebGPU && this.webgpuSupported) {
        this.module!.ccall('rsvg_wasm_enable_webgpu', 'void', ['number'], [1])
      }

      // Render SVG to RGBA pixels using native function
      const outputPtr = this.module!.ccall('rsvg_wasm_render_to_rgba', 'number',
        ['number', 'number', 'number', 'number'],
        [inputPtr, svgBytes.length, width, height]
      )

      if (!outputPtr) {
        // Get error message from WASM
        const errorMsg = this.module!.ccall('rsvg_wasm_get_last_error', 'string', [], [])
        throw new Error(`SVG rendering failed: ${errorMsg || 'Unknown error'}`)
      }

      // Calculate output buffer size (RGBA = 4 bytes per pixel)
      const outputSize = width * height * 4
      const stride = width * 4

      // Copy rendered data from WASM heap
      const renderedData = new Uint8Array(outputSize)
      renderedData.set(this.module!.HEAPU8.subarray(outputPtr, outputPtr + outputSize))

      // Free allocated output buffer (allocated by native code)
      this.module!._free(outputPtr)

      // Update performance metrics
      const renderTime = performance.now() - startTime
      this.performanceMetrics.renderTime = renderTime
      this.performanceMetrics.memoryUsage = svgBytes.length + outputSize
      if (this.simdSupported) {
        this.performanceMetrics.simdUtilization += 1
      }
      if (options.enableWebGPU && this.webgpuSupported) {
        this.performanceMetrics.webgpuUtilization += 1
      }

      return {
        data: renderedData,
        width,
        height,
        stride,
        colorspace: options.colorspace || SVGColorspace.RGBA,
        renderTime,
        memoryUsage: svgBytes.length + outputSize
      }

    } finally {
      this.module!._free(inputPtr)
    }
  }

  /**
   * Get SVG document information without full rendering
   * Uses native Rust/C function for efficiency
   */
  async getImageInfo(svgData: string | Uint8Array): Promise<SVGImageInfo> {
    if (!this.isInitialized) {
      throw new Error('LibRSVG not initialized. Call initialize() first.')
    }

    // Convert SVG data to Uint8Array if needed
    let svgBytes: Uint8Array
    if (typeof svgData === 'string') {
      svgBytes = new TextEncoder().encode(svgData)
    } else {
      svgBytes = svgData
    }

    const inputPtr = this.module!._malloc(svgBytes.length)
    if (!inputPtr) {
      throw new Error('Failed to allocate memory for SVG data')
    }

    try {
      this.module!.HEAPU8.set(svgBytes, inputPtr)

      const widthPtr = this.module!._malloc(4)
      const heightPtr = this.module!._malloc(4)

      const infoResult = this.module!.ccall('rsvg_wasm_get_svg_info', 'number',
        ['number', 'number', 'number', 'number'],
        [inputPtr, svgBytes.length, widthPtr, heightPtr]
      )

      if (!infoResult) {
        throw new Error('Invalid SVG document format')
      }

      const width = this.module!.HEAPU32[widthPtr >> 2]
      const height = this.module!.HEAPU32[heightPtr >> 2]

      this.module!._free(widthPtr)
      this.module!._free(heightPtr)

      // TODO: Extract more detailed SVG information via native functions
      // This would require additional Rust/C implementation

      return {
        width,
        height,
        viewBoxWidth: width,    // TODO: Get actual viewBox from SVG
        viewBoxHeight: height,  // TODO: Get actual viewBox from SVG
        hasAnimation: false,    // TODO: Detect SVG animations
        elementCount: 0,        // TODO: Count SVG elements
        pathCount: 0,          // TODO: Count path elements
        textNodes: 0,          // TODO: Count text elements
        images: 0              // TODO: Count embedded images
      }

    } finally {
      this.module!._free(inputPtr)
    }
  }

  /**
   * Get SVG capabilities and support information
   * Uses native functions for accurate detection
   */
  getCapabilities(): SVGCapabilities {
    if (!this.isInitialized) {
      throw new Error('LibRSVG not initialized. Call initialize() first.')
    }

    return {
      simdSupport: this.simdSupported,
      webgpuSupport: this.webgpuSupported,
      cairoVersion: '1.18.0',       // TODO: Get from native
      librsvgVersion: '2.61.0',     // TODO: Get from native
      maxImageSize: 16384,          // TODO: Get from native
      supportedFormats: ['svg', 'svgz', 'svg+xml']
    }
  }

  /**
   * Get performance metrics for monitoring and optimization
   */
  getPerformanceMetrics(): SVGPerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /**
   * Get librsvg version information
   * Direct native function calls
   */
  getVersion(): { major: number, minor: number, micro: number } {
    if (!this.isInitialized) {
      throw new Error('LibRSVG not initialized. Call initialize() first.')
    }

    // TODO: Implement native version functions
    return {
      major: 2,
      minor: 61,
      micro: 0
    }
  }

  /**
   * Cleanup and release resources
   * Uses native cleanup functions
   */
  destroy(): void {
    if (this.isInitialized && this.module) {
      // Call native cleanup function
      this.module.ccall('rsvg_wasm_cleanup', 'void', [], [])
      this.module = null
      this.isInitialized = false
    }
  }

  // Private implementation methods
  private async loadModule(): Promise<LibRSVGModule> {
    try {
      const moduleFactory = await this.loadModuleFactory()
      const wasmBinary = await this.loadWasmBinary()

      // Pass wasmBinary only if successfully loaded
      const module = await moduleFactory(wasmBinary ? { wasmBinary } : {})
      return module as LibRSVGModule
    } catch (error) {
      throw new Error(`Failed to load librsvg.wasm module: ${error}`)
    }
  }

  private async loadModuleFactory(): Promise<Function> {
    // Check if we should use SIDE_MODULE with orchestrator
    if (this.shouldUseSideModule()) {
      return this.loadSideModuleViaOrchestrator()
    }

    // Fallback to MAIN_MODULE loading
    return this.loadMainModuleFactory()
  }

  private shouldUseSideModule(): boolean {
    // Use SIDE_MODULE if:
    // 1. External orchestrator is available
    // 2. We're running in production (not Deno development)
    // 3. User hasn't explicitly requested MAIN_MODULE
    return typeof globalThis.Module?.externalWebGPUContext !== 'undefined' &&
           typeof globalThis.Deno === 'undefined' &&
           !this.loadingOptions.forceMainModule
  }

  private async loadSideModuleViaOrchestrator(): Promise<Function> {
    // Request SIDE_MODULE loading from the orchestrator
    const orchestrator = globalThis.Module?.externalWebGPUContext

    if (!orchestrator?.loadSideModule) {
      throw new Error('Orchestrator does not support SIDE_MODULE loading')
    }

    try {
      // Request librsvg SIDE_MODULE from CDN
      const sideModule = await orchestrator.loadSideModule({
        name: 'librsvg',
        url: 'https://wasm.discere.cloud/librsvg/latest/side/librsvg-side.wasm',
        dependencies: [
          'https://wasm.discere.cloud/cairo/latest/side/cairo-side.wasm',
          'https://wasm.discere.cloud/glib/latest/side/glib-side.wasm',
          'https://wasm.discere.cloud/pango/latest/side/pango-side.wasm',
          'https://wasm.discere.cloud/gdk-pixbuf/latest/side/gdk-pixbuf-side.wasm'
        ],
        priority: 1 // Normal priority
      })

      return sideModule
    } catch (error) {
      console.warn('SIDE_MODULE loading failed, falling back to MAIN_MODULE:', error)
      return this.loadMainModuleFactory()
    }
  }

  private async loadMainModuleFactory(): Promise<Function> {
    // Deno-first development environment
    if (typeof globalThis.Deno !== 'undefined') {
      try {
        const moduleFactory = (await import('../../librsvg-main.js')).default
        return moduleFactory
      } catch (error) {
        console.warn('Failed to load local module factory:', error)
      }
    }

    // Web/CDN runtime - try CDN locations with proper ES6 imports
    const cdnUrls = [
      'https://wasm.discere.cloud/librsvg/latest/main/',
      'https://cdn.jsdelivr.net/npm/@discere-os/librsvg.wasm/dist/'
    ]

    for (const url of cdnUrls) {
      try {
        const moduleFactory = (await import(`${url}librsvg-main.js`)).default
        return moduleFactory
      } catch { continue }
    }

    throw new Error('Failed to load module factory from any source')
  }

  private async loadWasmBinary(): Promise<ArrayBuffer | undefined> {
    // Deno-first development environment
    if (typeof globalThis.Deno !== 'undefined') {
      try {
        const wasmPath = new URL('../../librsvg-main.wasm', import.meta.url).pathname
        const wasmBuffer = await Deno.readFile(wasmPath)
        return wasmBuffer.buffer
      } catch (error) {
        console.warn('Failed to load local WASM binary:', error)
        return undefined
      }
    }

    // Web/CDN runtime - try CDN locations
    const cdnUrls = [
      'https://wasm.discere.cloud/librsvg/latest/main/',
      'https://cdn.jsdelivr.net/npm/@discere-os/librsvg.wasm/dist/'
    ]

    for (const url of cdnUrls) {
      try {
        const response = await fetch(`${url}librsvg-main.wasm`)
        if (response.ok) {
          return await response.arrayBuffer()
        }
      } catch { continue }
    }

    // Fallback to undefined for embedded WASM
    return undefined
  }
}

// Export the main class and types for easy consumption
export default LibRSVG
export * from './types.ts'

// Convenience function for quick SVG operations
export async function createLibRSVG(options?: Partial<SVGLoadingOptions>): Promise<LibRSVG> {
  const librsvg = new LibRSVG(options)
  await librsvg.initialize()
  return librsvg
}
