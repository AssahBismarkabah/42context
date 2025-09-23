import { pipeline, env } from '@xenova/transformers';

// Set environment variables for Transformers.js
env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = ''; // Configure WASM backend for ONNX

/**
 * Creates and returns a Transformers.js pipeline for feature extraction.
 * This function is dynamically imported to allow for fallback mechanisms
 * if Transformers.js is not available or fails to load.
 * @returns A function that can create a feature-extraction pipeline.
 */
export async function createTransformersPipeline() {
  // Ensure the pipeline function is only loaded once
  return pipeline;
}