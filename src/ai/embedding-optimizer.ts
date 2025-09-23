
import { pipeline, Pipeline } from '@xenova/transformers';
import { MemoryManager } from '../mcp/memory-manager';
import { MemoryConfigManager } from '../mcp/memory-config';
import { CodeChunk, EmbeddingResult } from '../core/types';

/**
 * Configuration for the embedding optimizer
 */
export interface EmbeddingOptimizerConfig {
  maxConcurrentOperations: number;
  tensorCleanupIntervalMs: number;
  modelRefreshInterval: number;
  enableResourcePooling: boolean;
  maxResourcePoolSize: number;
  resourceTimeoutMs: number;
}

/**
 * Resource pool for managing embedding resources
 */
class ResourcePool {
  private pool: any[] = [];
  private activeCount = 0;
  private waiting: Array<(resource: any) => void> = [];

  constructor(
    private maxSize: number,
    private timeoutMs: number
  ) {}

  async acquire(): Promise<any> {
    if (this.pool.length > 0) {
      this.activeCount++;
      return this.pool.pop();
    }

    if (this.activeCount < this.maxSize) {
      this.activeCount++;
      return { id: Math.random().toString(36).substr(2, 9) };
    }

    // Wait for available resource
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiting.indexOf(resolve);
        if (index > -1) {
          this.waiting.splice(index, 1);
        }
        reject(new Error('Resource pool timeout'));
      }, this.timeoutMs);

      this.waiting.push((resource: any) => {
        clearTimeout(timeout);
        resolve(resource);
      });
    });
  }

  release(resource: any): void {
    this.activeCount--;
    
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift()!;
      waiter(resource);
    } else if (this.pool.length < this.maxSize) {
      this.pool.push(resource);
    }
  }

  async cleanup(): Promise<void> {
    this.pool = [];
    this.waiting = [];
    this.activeCount = 0;
  }

  getStats(): { poolSize: number; activeCount: number } {
    return {
      poolSize: this.pool.length,
      activeCount: this.activeCount
    };
  }
}

/**
 * Tensor cleanup manager
 */
class TensorCleanupManager {
  private tensors: any[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private intervalMs: number) {
    this.startCleanupInterval();
  }

  registerTensor(tensor: any): void {
    this.tensors.push(tensor);
  }

  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.intervalMs);
  }

  private performCleanup(): void {
    // Clean up tensors that are no longer needed
    for (const tensor of this.tensors) {
      if (tensor && typeof tensor.dispose === 'function') {
        try {
          tensor.dispose();
        } catch (error) {
          // Ignore disposal errors
        }
      }
    }
    this.tensors = [];
  }

  forceCleanup(): void {
    this.performCleanup();
  }

  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Advanced embedding service with memory optimization and resource pooling
 */
export class EmbeddingOptimizer {
  private model: Pipeline | null = null;
  private isModelLoaded = false;
  private modelLoadTime = 0;
  private memoryManager: MemoryManager;
  private resourcePool: ResourcePool;
  private tensorCleanup: TensorCleanupManager;
  private config: EmbeddingOptimizerConfig;

  constructor(config?: Partial<EmbeddingOptimizerConfig>) {
    this.config = {
      maxConcurrentOperations: 1,
      tensorCleanupIntervalMs: 5000,
      modelRefreshInterval: 300000, // 5 minutes
      enableResourcePooling: true,
      maxResourcePoolSize: 3,
      resourceTimeoutMs: 30000,
      ...config
    };

    this.memoryManager = new MemoryManager();
    this.resourcePool = new ResourcePool(
      this.config.maxResourcePoolSize,
      this.config.resourceTimeoutMs
    );
    this.tensorCleanup = new TensorCleanupManager(this.config.tensorCleanupIntervalMs);
  }

  /**
   * Initialize the embedding optimizer
   */
  async initialize(): Promise<void> {
    console.log('[EmbeddingOptimizer] Initializing with memory optimization...');
    
    // Check initial memory state
    const initialReport = this.memoryManager.getMemoryReport();
    console.log(`[EmbeddingOptimizer] Initial memory: ${initialReport.current.heapUsedMB.toFixed(1)}MB used`);
    
    // Load model with optimization
    await this.loadModelWithOptimization();
    
    console.log('[EmbeddingOptimizer] Initialization complete');
  }

  /**
   * Load model with memory optimization
   */
  private async loadModelWithOptimization(): Promise<void> {
    console.log('[EmbeddingOptimizer] Loading model with optimization...');
    
    const startTime = Date.now();
    
    try {
      // Check memory before loading
      const pressure = this.memoryManager.checkMemoryPressure();
      if (pressure.shouldForceGC) {
        await this.memoryManager.forceGarbageCollection('pre_model_load');
      }
      
      // Load model with optimized settings
      const model = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          // Memory optimization options
          quantized: true, // Use quantized model if available
          cache_dir: './.cache', // Local cache
          local_files_only: false
        }
      );
      this.model = model as any;
      
      this.isModelLoaded = true;
      this.modelLoadTime = Date.now() - startTime;
      
      console.log(`[EmbeddingOptimizer] Model loaded in ${this.modelLoadTime}ms`);
      
      // Schedule periodic model refresh to prevent memory buildup
      if (this.config.modelRefreshInterval > 0) {
        setTimeout(() => this.refreshModel(), this.config.modelRefreshInterval);
      }
      
      return;
    } catch (error) {
      console.error('[EmbeddingOptimizer] Model loading failed:', error);
      throw error;
    }
  }

  /**
   * Refresh model to prevent memory buildup
   */
  private async refreshModel(): Promise<void> {
    console.log('[EmbeddingOptimizer] Refreshing model to prevent memory buildup...');
    
    try {
      // Force cleanup before refresh
      this.tensorCleanup.forceCleanup();
      
      // Clear model reference
      if (this.model && typeof this.model.dispose === 'function') {
        await this.model.dispose();
      }
      
      this.model = null;
      this.isModelLoaded = false;
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (global.gc) global.gc();
      }
      
      // Reload model
      await this.loadModelWithOptimization();
      
      console.log('[EmbeddingOptimizer] Model refresh complete');
    } catch (error) {
      console.error('[EmbeddingOptimizer] Model refresh failed:', error);
    }
  }

  /**
   * Generate embedding for a single chunk with memory optimization
   */
  async generateEmbedding(chunk: CodeChunk): Promise<EmbeddingResult> {
    if (!this.isModelLoaded) {
      await this.initialize();
    }

    // Check memory pressure
    const pressure = this.memoryManager.checkMemoryPressure();
    if (pressure.shouldPause) {
      await this.memoryManager.waitForMemoryPressureReduction(10000);
    }

    try {
      // Acquire resource from pool
      const pooledResource = await this.resourcePool.acquire();
      
      // Prepare text for embedding
      const text = this.prepareChunkText(chunk);
      
      // Generate embedding with memory monitoring
      let output: any;
      
      try {
        // Monitor memory during processing
        const startMemory = process.memoryUsage().heapUsed;
        
        // Generate embedding
        output = await this.model!(text, {
          pooling: 'mean',
          normalize: true
        });
        
        // Check memory spike
        const endMemory = process.memoryUsage().heapUsed;
        const memorySpike = (endMemory - startMemory) / 1024 / 1024; // MB
        
        if (memorySpike > 100) { // If memory spike > 100MB
          console.warn(`[EmbeddingOptimizer] Large memory spike detected: ${memorySpike.toFixed(1)}MB`);
          await this.memoryManager.forceGarbageCollection('embedding_memory_spike');
        }
        
        // Extract embedding vector
        const embedding = Array.from(output.data) as number[];
        
        // Register tensor for cleanup
        this.tensorCleanup.registerTensor(output);
        
        // Release resource back to pool
        this.resourcePool.release(pooledResource);
        
        return {
          chunkId: chunk.id,
          vector: embedding,
          dimension: embedding.length,
          timestamp: Date.now(),
          model: 'Xenova/all-MiniLM-L6-v2'
        };
      } catch (error) {
        // Ensure resource is released even on error
        this.resourcePool.release(pooledResource);
        throw error;
      }
    } catch (error) {
      console.error(`[EmbeddingOptimizer] Failed to generate embedding for chunk ${chunk.id}:`, error);
      throw error;
    }
  }

  /**
  /**
   * Generate embeddings for multiple chunks with memory optimization
   */
  async generateBatchEmbeddings(chunks: CodeChunk[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    const memoryConfig = MemoryConfigManager.getInstance().getConfig();
    
    console.log(`[EmbeddingOptimizer] Processing ${chunks.length} chunks with memory optimization`);
    
    // Process chunks with controlled concurrency
    const maxConcurrent = Math.min(
      this.config.maxConcurrentOperations,
      memoryConfig.batchProcessing.initialBatchSize
    );
    
    for (let i = 0; i < chunks.length; i += maxConcurrent) {
      const batch = chunks.slice(i, i + maxConcurrent);
      const batchNumber = Math.floor(i / maxConcurrent) + 1;
      const totalBatches = Math.ceil(chunks.length / maxConcurrent);
      
      console.log(`[EmbeddingOptimizer] Processing optimized batch ${batchNumber}/${totalBatches}`);
      
      // Check memory before batch
      const pressure = this.memoryManager.checkMemoryPressure();
      if (pressure.shouldForceGC) {
        await this.memoryManager.forceGarbageCollection(`optimized_batch_${batchNumber}`);
      }
      
      // Process batch sequentially to avoid memory spikes
      for (const chunk of batch) {
        try {
          const embedding = await this.generateEmbedding(chunk);
          results.push(embedding);
          
          // Small delay between embeddings
          await new Promise(resolve => setTimeout(resolve, memoryConfig.delays.betweenEmbeddingsMs));
        } catch (error) {
          console.error(`[EmbeddingOptimizer] Failed to process chunk ${chunk.id}:`, error);
          // Continue with other chunks
          continue;
        }
      }
      
      // Force cleanup after batch
      this.tensorCleanup.forceCleanup();
      
      // Brief pause between batches
      if (batchNumber < totalBatches) {
        await new Promise(resolve => setTimeout(resolve, memoryConfig.delays.afterBatchMs));
      }
    }
    
    console.log(`[EmbeddingOptimizer] Completed processing ${results.length}/${chunks.length} chunks`);
    return results;
  }

  /**
   * Prepare chunk text for embedding
   */
  private prepareChunkText(chunk: CodeChunk): string {
    const parts: string[] = [];
    
    // Add chunk type and content
    parts.push(`${chunk.type}: ${chunk.content.substring(0, 200)}`);
    
    // Add language
    parts.push(`Language: ${chunk.language}`);
    
    // Add file path for context
    parts.push(`File: ${chunk.filePath}`);
    
    return parts.join('\n');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('[EmbeddingOptimizer] Cleaning up resources...');
    
    // Stop cleanup interval
    this.tensorCleanup.stopCleanupInterval();
    
    // Force final cleanup
    this.tensorCleanup.forceCleanup();
    
    // Cleanup resource pool
    await this.resourcePool.cleanup();
    
    // Dispose model if possible
    if (this.model && typeof this.model.dispose === 'function') {
      try {
        await this.model.dispose();
      } catch (error) {
        console.warn('[EmbeddingOptimizer] Model disposal failed:', error);
      }
    }
    
    this.model = null;
    this.isModelLoaded = false;
    
    // Final garbage collection
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 500));
      if (global.gc) global.gc();
    }
    
    console.log('[EmbeddingOptimizer] Cleanup complete');
  }

  /**
   * Get optimizer statistics
   */
  getStats(): {
    isModelLoaded: boolean;
    modelLoadTime: number;
    resourcePool: { poolSize: number; activeCount: number };
    memoryManager: any;
  } {
    return {
      isModelLoaded: this.isModelLoaded,
      modelLoadTime: this.modelLoadTime,
      resourcePool: this.resourcePool.getStats(),
      memoryManager: this.memoryManager.getMemoryReport()
    };
  }
}