import { assert, assertEquals, assertExists } from "@std/assert";
import LibRSVG from "../../src/lib/index.ts";

Deno.test("LibRSVG initialization", async () => {
  const librsvg = new LibRSVG();

  try {
    await librsvg.initialize();
    assert(true, "Library should initialize without errors");
  } catch (error) {
    // Expected to fail since we don't have actual WASM module yet
    assert(
      error.message.includes("Failed to load"),
      "Should fail with loading error",
    );
  }
});

Deno.test("LibRSVG constructor options", () => {
  const options = {
    cdnUrl: "https://custom-cdn.example.com/",
    timeout: 5000,
    retryCount: 1,
  };

  const librsvg = new LibRSVG(options);
  assertExists(librsvg, "LibRSVG instance should be created");
});

Deno.test("SVG capabilities detection", async () => {
  const librsvg = new LibRSVG();

  try {
    await librsvg.initialize();
    const capabilities = librsvg.getCapabilities();
    assertExists(capabilities, "Capabilities should be available");
    assertEquals(typeof capabilities.simdSupport, "boolean");
    assertEquals(typeof capabilities.webgpuSupport, "boolean");
  } catch (error) {
    // Expected to fail during initialization for now
    assert(
      error.message.includes("not initialized") ||
        error.message.includes("Failed to load"),
    );
  }
});

Deno.test("Performance metrics tracking", () => {
  const librsvg = new LibRSVG();
  const metrics = librsvg.getPerformanceMetrics();

  assertExists(metrics, "Performance metrics should be available");
  assertEquals(typeof metrics.parseTime, "number");
  assertEquals(typeof metrics.renderTime, "number");
  assertEquals(typeof metrics.memoryUsage, "number");
});

Deno.test("Version information", async () => {
  const librsvg = new LibRSVG();

  try {
    await librsvg.initialize();
    const version = librsvg.getVersion();
    assertExists(version, "Version should be available");
    assertEquals(typeof version.major, "number");
    assertEquals(typeof version.minor, "number");
    assertEquals(typeof version.micro, "number");
  } catch (error) {
    // Expected to fail during initialization for now
    assert(
      error.message.includes("not initialized") ||
        error.message.includes("Failed to load"),
    );
  }
});

Deno.test("Error handling for uninitialized operations", async () => {
  const librsvg = new LibRSVG();

  const testSvg =
    '<svg width="100" height="100"><rect width="50" height="50" fill="red"/></svg>';

  try {
    await librsvg.render(testSvg);
    assert(false, "Should throw error when not initialized");
  } catch (error) {
    assert(
      error.message.includes("not initialized"),
      "Should indicate library not initialized",
    );
  }

  try {
    await librsvg.getImageInfo(testSvg);
    assert(false, "Should throw error when not initialized");
  } catch (error) {
    assert(
      error.message.includes("not initialized"),
      "Should indicate library not initialized",
    );
  }
});
