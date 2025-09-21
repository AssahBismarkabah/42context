/**
 * ESM wrapper for Transformers.js to handle dynamic imports properly
 */

export async function createTransformersPipeline() {
  try {
    const { pipeline } = await import('@xenova/transformers');
    return pipeline;
  } catch (error) {
    console.error('Failed to import Transformers.js:', error);
    throw error;
  }
}