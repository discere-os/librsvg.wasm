#!/usr/bin/env deno run --allow-all
/**
 * NPM Package Builder for librsvg.wasm
 *
 * Creates NPM-compatible package from Deno-first TypeScript source
 */

import { build, emptyDir } from "https://deno.land/x/dnt@0.40.0/mod.ts"

const outDir = "./npm"

// Clean output directory
await emptyDir(outDir)

// Build NPM package using DNT
await build({
  entryPoints: ["./src/lib/index.ts"],
  outDir,
  shims: {
    // Provide Node.js compatibility shims
    deno: true,
    webSocket: true,
    crypto: true
  },
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    sourceMap: true
  },
  package: {
    name: "@discere-os/librsvg.wasm",
    version: "2.61.0",
    description: "Production-ready SVG rendering via WebAssembly with WebGPU acceleration",
    keywords: [
      "svg",
      "wasm",
      "webassembly",
      "graphics",
      "rendering",
      "webgpu",
      "simd",
      "librsvg",
      "cairo",
      "rust",
      "performance"
    ],
    author: "Discere OS <hello@discere.school>",
    license: "LGPL-2.1-or-later",
    homepage: "https://github.com/discere-os/discere-nucleus/tree/main/client/emscripten/librsvg.wasm",
    repository: {
      type: "git",
      url: "git+https://github.com/discere-os/discere-nucleus.git",
      directory: "client/emscripten/librsvg.wasm"
    },
    bugs: {
      url: "https://github.com/discere-os/discere-nucleus/issues"
    },
    engines: {
      node: ">=18.0.0"
    },
    browserslist: [
      "Chrome >= 113",
      "Edge >= 113"
    ],
    files: [
      "esm/",
      "script/",
      "types/",
      "*.wasm",
      "*.js",
      "README.md",
      "COPYING.LIB"
    ],
    exports: {
      ".": {
        "import": "./esm/lib/index.js",
        "require": "./script/lib/index.js",
        "types": "./types/lib/index.d.ts"
      },
      "./side": {
        "types": "./types/lib/index.d.ts",
        "default": "./librsvg-side.wasm"
      },
      "./main": {
        "types": "./types/lib/index.d.ts",
        "default": "./librsvg-main.wasm"
      },
      "./package.json": "./package.json"
    },
    type: "module",
    funding: {
      type: "individual",
      url: "https://github.com/sponsors/discere-os"
    },
    publishConfig: {
      registry: "https://registry.npmjs.org/",
      access: "public"
    }
  },
  postBuild() {
    // Copy WASM files and additional assets
    console.log("📦 Copying WASM files to NPM package...")

    try {
      // Copy WASM binaries if they exist
      if (Deno.statSync("./librsvg-side.wasm")) {
        Deno.copyFileSync("./librsvg-side.wasm", `${outDir}/librsvg-side.wasm`)
        console.log("   ✅ librsvg-side.wasm")
      }
    } catch {
      console.log("   ⚠️ librsvg-side.wasm not found (run build:wasm)")
    }

    try {
      if (Deno.statSync("./librsvg-main.wasm")) {
        Deno.copyFileSync("./librsvg-main.wasm", `${outDir}/librsvg-main.wasm`)
        console.log("   ✅ librsvg-main.wasm")
      }
    } catch {
      console.log("   ⚠️ librsvg-main.wasm not found (run build:wasm)")
    }

    try {
      if (Deno.statSync("./librsvg-main.js")) {
        Deno.copyFileSync("./librsvg-main.js", `${outDir}/librsvg-main.js`)
        console.log("   ✅ librsvg-main.js")
      }
    } catch {
      console.log("   ⚠️ librsvg-main.js not found (run build:wasm)")
    }

    // Copy license file
    try {
      Deno.copyFileSync("../../../COPYING.LESSERv3", `${outDir}/COPYING.LIB`)
      console.log("   ✅ COPYING.LIB")
    } catch {
      console.log("   ⚠️ License file not found")
    }

    // Create README.md for NPM
    const readme = `# LibRSVG.wasm

Production-ready SVG rendering via WebAssembly with WebGPU acceleration.

## Features

- 🚀 **High Performance**: Native librsvg + Cairo rendering with WASM SIMD
- 🎮 **WebGPU Acceleration**: GPU-accelerated rendering for complex SVGs
- 🌐 **Browser Native**: Runs in Chrome/Edge 113+ with full feature support
- 📦 **Dual Architecture**: SIDE_MODULE for production, MAIN_MODULE for testing
- 🔒 **Type Safe**: Complete TypeScript definitions with zero runtime deps
- ⚡ **Zero Config**: Works out of the box with ES6 imports

## Installation

\`\`\`bash
npm install @discere-os/librsvg.wasm
\`\`\`

## Quick Start

\`\`\`typescript
import LibRSVG from '@discere-os/librsvg.wasm'

const librsvg = new LibRSVG()
await librsvg.initialize()

const result = await librsvg.render(\`
  <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="red"/>
  </svg>
\`)

console.log(\`Rendered \${result.width}×\${result.height} image\`)
// result.data contains RGBA pixel data as Uint8Array
\`\`\`

## Browser Requirements

- Chrome 113+ or Edge 113+
- WebGPU support (for GPU acceleration)
- WASM SIMD support
- SharedArrayBuffer (for threading)

## License

LGPL-2.1-or-later - Same as librsvg

## Documentation

See [GitHub Repository](https://github.com/discere-os/discere-nucleus/tree/main/client/emscripten/librsvg.wasm) for complete documentation and examples.
`

    Deno.writeTextFileSync(`${outDir}/README.md`, readme)
    console.log("   ✅ README.md")

    console.log("✅ NPM package build completed!")
  },
})

console.log("🎉 librsvg.wasm NPM package ready in ./npm/")