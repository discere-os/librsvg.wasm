/**
 * TypeScript definitions for librsvg.wasm v2.61.0
 * WASM-native interface for SVG rendering
 *
 * Based on librsvg 2.61.0 with WebGPU acceleration and advanced SVG features
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

// SVG Color Models
export enum SVGColorspace {
  RGBA = 0,
  BGRA = 1,
  ARGB = 2,
  RGB = 3,
  BGR = 4,
}

// SVG Rendering Units
export enum SVGUnits {
  PIXELS = 0,
  POINTS = 1,
  INCHES = 2,
  MILLIMETERS = 3,
  CENTIMETERS = 4,
  PERCENT = 5,
}

// SVG Aspect Ratio Preservation
export enum SVGAspectRatio {
  NONE = 0,
  MEET = 1,
  SLICE = 2,
}

// SVG Error codes
export enum SVGErrorCode {
  OK = 0,
  OUT_OF_MEMORY = 1,
  INVALID_SVG_DATA = 2,
  PARSING_ERROR = 3,
  RENDERING_ERROR = 4,
  CAIRO_ERROR = 5,
  DIMENSION_ERROR = 6,
  VIEWPORT_ERROR = 7,
  WEBGPU_ERROR = 8,
  SIMD_ERROR = 9,
}

// Basic Emscripten module interface
interface EmscriptenModule {
  _malloc(size: number): number;
  _free(ptr: number): void;
  ccall(
    ident: string,
    returnType: string,
    argTypes: string[],
    args: unknown[],
  ): unknown;
  cwrap(
    ident: string,
    returnType: string,
    argTypes: string[],
  ): (...args: unknown[]) => unknown;
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  UTF8ToString(ptr: number): string;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
}

// Main librsvg.wasm module interface
export interface LibRSVGModule extends EmscriptenModule {
  // Memory management
  _malloc(size: number): number;
  _free(ptr: number): void;

  // Core librsvg API (direct Rust bindings)
  _rsvg_handle_new(): number;
  _rsvg_handle_new_from_data(
    data: number,
    dataSize: number,
    error: number,
  ): number;
  _rsvg_handle_set_dpi(handle: number, dpi: number): void;
  _rsvg_handle_get_dimensions(handle: number, dimensions: number): number;
  _rsvg_handle_render_cairo(handle: number, cr: number): number;
  _rsvg_handle_close(handle: number, error: number): void;

  // Cairo integration (for pixel buffer rendering)
  _cairo_image_surface_create(
    format: number,
    width: number,
    height: number,
  ): number;
  _cairo_image_surface_get_data(surface: number): number;
  _cairo_image_surface_get_width(surface: number): number;
  _cairo_image_surface_get_height(surface: number): number;
  _cairo_image_surface_get_stride(surface: number): number;
  _cairo_create(surface: number): number;
  _cairo_destroy(cr: number): void;
  _cairo_surface_destroy(surface: number): void;

  // WASM-native optimized functions (custom C/C++ layer)
  _rsvg_wasm_render_to_rgba(
    svgData: number,
    svgLen: number,
    width: number,
    height: number,
  ): number;
  _rsvg_wasm_get_svg_info(
    svgData: number,
    svgLen: number,
    width: number,
    height: number,
  ): number;
  _rsvg_wasm_set_viewport(width: number, height: number): void;
  _rsvg_wasm_get_simd_support(): number;
  _rsvg_wasm_enable_webgpu(enabled: number): void;
  _rsvg_wasm_get_last_error(): string;
  _rsvg_wasm_cleanup(): void;

  // Dynamic loading functions (MAIN_MODULE only)
  _dlopen?(filename: string, flags: number): number;
  _dlsym?(handle: number, symbol: string): number;
  _dlclose?(handle: number): number;
}

// SVG document metadata
export interface SVGImageInfo {
  width: number;
  height: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  hasAnimation: boolean;
  elementCount: number;
  pathCount: number;
  textNodes: number;
  images: number;
}

// SVG rendering options
export interface SVGRenderOptions {
  backgroundColor?: string; // CSS color string
  scale?: number; // Scale factor (default 1.0)
  width?: number; // Target width in pixels
  height?: number; // Target height in pixels
  dpi?: number; // DPI for text/vector rendering (default 90)
  colorspace?: SVGColorspace; // Output color format
  aspectRatio?: SVGAspectRatio; // Aspect ratio preservation
  clipToViewBox?: boolean; // Clip to SVG viewBox
  enableAntialiasing?: boolean; // Anti-aliasing (default true)
  enableWebGPU?: boolean; // WebGPU acceleration
  maxMemoryMB?: number; // Memory limit for large SVGs
}

// SVG processing result
export interface SVGResult {
  data: Uint8Array;
  width: number;
  height: number;
  stride: number;
  colorspace: SVGColorspace;
  renderTime: number;
  memoryUsage: number;
}

// SVG capabilities detection
export interface SVGCapabilities {
  simdSupport: boolean;
  webgpuSupport: boolean;
  cairoVersion: string;
  librsvgVersion: string;
  maxImageSize: number;
  supportedFormats: string[];
}

// SVG loading options
export interface SVGLoadingOptions {
  cdnUrl: string;
  fallbackUrls: string[];
  timeout?: number;
  retryCount?: number;
  useCache?: boolean;
  maxFileSizeMB?: number;
  forceMainModule?: boolean; // Force MAIN_MODULE even if orchestrator available
}

// Error classes
export class SVGError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message);
    this.name = "SVGError";
  }
}

export class SVGParsingError extends SVGError {
  constructor(message: string) {
    super(message);
    this.name = "SVGParsingError";
  }
}

export class SVGRenderingError extends SVGError {
  constructor(message: string) {
    super(message);
  }
}

export class SVGMemoryError extends SVGError {
  constructor(message: string) {
    super(message);
    this.name = "SVGMemoryError";
  }
}

// Performance monitoring
export interface SVGPerformanceMetrics {
  parseTime: number;
  renderTime: number;
  memoryUsage: number;
  simdUtilization: number;
  webgpuUtilization: number;
}

// Orchestrator types for SIDE_MODULE loading
export interface WebGPUOrchestrator {
  loadSideModule(config: {
    name: string;
    url: string;
    dependencies?: string[];
    priority?: number;
  }): Promise<() => LibRSVGModule>;
  shareDevice?: boolean;
  requestComputeContext?: (config: unknown) => unknown;
}

// Global module extensions
// Global type extensions for WebGPU orchestrator
export interface GlobalModule {
  externalWebGPUContext?: WebGPUOrchestrator;
}

export interface GlobalWindow extends Window {
  Module?: GlobalModule;
}

export type GlobalModuleVar = GlobalModule | undefined;
