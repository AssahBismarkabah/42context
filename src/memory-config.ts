/**
 * Centralized memory management configuration
 * Provides consistent memory settings across the application
 */

export interface MemoryConfig {
  // Memory thresholds in MB
  thresholds: {
    maxHeapSizeMB: number;
    gcThresholdMB: number;
    batchSizeReductionMB: number;
    emergencyThresholdMB: number;
    warningThresholdMB: number;
  };
  
  // Batch processing settings
  batchProcessing: {
    initialBatchSize: number;
    minBatchSize: number;
    maxBatchSize: number;
    reductionFactor: number;
  };
  
  // GC settings
  garbageCollection: {
    enabled: boolean;
    intervalMs: number;
    emergencyGCIntervalMs: number;
    maxConsecutiveGCs: number;
  };
  
  // Processing delays
  delays: {
    betweenEmbeddingsMs: number;
    betweenFilesMs: number;
    afterBatchMs: number;
    gcCompletionMs: number;
  };
  
  // Timeout settings
  timeouts: {
    memoryPressureReductionMs: number;
    gcTimeoutMs: number;
    batchTimeoutMs: number;
  };
}

/**
 * Default memory configuration optimized for Node.js and Transformers.js
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  thresholds: {
    maxHeapSizeMB: 1200,        // Conservative Node.js heap limit
    gcThresholdMB: 600,         // Force GC at 600MB
    batchSizeReductionMB: 800,  // Reduce batch size at 800MB
    emergencyThresholdMB: 1000, // Emergency pause at 1GB
    warningThresholdMB: 500     // Log warnings at 500MB
  },
  
  batchProcessing: {
    initialBatchSize: 50,       // Start with 50 files
    minBatchSize: 5,            // Never go below 5 files
    maxBatchSize: 100,          // Cap at 100 files
    reductionFactor: 0.5        // Reduce batch size by 50% when needed
  },
  
  garbageCollection: {
    enabled: true,
    intervalMs: 5000,           // 5 seconds between GCs
    emergencyGCIntervalMs: 1000, // 1 second in emergency
    maxConsecutiveGCs: 3        // Limit consecutive GC calls
  },
  
  delays: {
    betweenEmbeddingsMs: 5,     // 5ms between embeddings
    betweenFilesMs: 10,         // 10ms between files
    afterBatchMs: 200,          // 200ms after large batches
    gcCompletionMs: 100         // 100ms after GC
  },
  
  timeouts: {
    memoryPressureReductionMs: 30000, // 30 seconds max wait
    gcTimeoutMs: 5000,                // 5 seconds GC timeout
    batchTimeoutMs: 60000             // 1 minute per batch max
  }
};

/**
 * Memory configurations for different scenarios
 */
export const MEMORY_PROFILES = {
  // Conservative profile for limited memory environments
  conservative: {
    ...DEFAULT_MEMORY_CONFIG,
    thresholds: {
      ...DEFAULT_MEMORY_CONFIG.thresholds,
      maxHeapSizeMB: 800,
      gcThresholdMB: 400,
      batchSizeReductionMB: 500,
      emergencyThresholdMB: 600
    },
    batchProcessing: {
      ...DEFAULT_MEMORY_CONFIG.batchProcessing,
      initialBatchSize: 20,
      maxBatchSize: 30
    }
  },
  
  // Aggressive profile for high-performance systems
  aggressive: {
    ...DEFAULT_MEMORY_CONFIG,
    thresholds: {
      ...DEFAULT_MEMORY_CONFIG.thresholds,
      maxHeapSizeMB: 1800,
      gcThresholdMB: 1000,
      batchSizeReductionMB: 1200,
      emergencyThresholdMB: 1500
    },
    batchProcessing: {
      ...DEFAULT_MEMORY_CONFIG.batchProcessing,
      initialBatchSize: 100,
      maxBatchSize: 200
    },
    delays: {
      ...DEFAULT_MEMORY_CONFIG.delays,
      betweenEmbeddingsMs: 1,
      betweenFilesMs: 5
    }
  },
  
  // Development profile with extra logging
  development: {
    ...DEFAULT_MEMORY_CONFIG,
    garbageCollection: {
      ...DEFAULT_MEMORY_CONFIG.garbageCollection,
      intervalMs: 2000 // More frequent GC for debugging
    }
  }
};

/**
 * Memory configuration manager
 */
export class MemoryConfigManager {
  private static instance: MemoryConfigManager;
  private config: MemoryConfig;

  private constructor(config: MemoryConfig = DEFAULT_MEMORY_CONFIG) {
    this.config = config;
  }

  static getInstance(config?: MemoryConfig): MemoryConfigManager {
    if (!MemoryConfigManager.instance) {
      MemoryConfigManager.instance = new MemoryConfigManager(config);
    }
    return MemoryConfigManager.instance;
  }

  getConfig(): MemoryConfig {
    return this.config;
  }

  updateConfig(newConfig: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  setProfile(profileName: keyof typeof MEMORY_PROFILES): void {
    if (MEMORY_PROFILES[profileName]) {
      this.config = MEMORY_PROFILES[profileName];
      console.log(`[MemoryConfig] Switched to ${profileName} profile`);
    } else {
      console.warn(`[MemoryConfig] Unknown profile: ${profileName}`);
    }
  }

  getThresholds() {
    return this.config.thresholds;
  }

  getBatchProcessing() {
    return this.config.batchProcessing;
  }

  getGarbageCollection() {
    return this.config.garbageCollection;
  }

  getDelays() {
    return this.config.delays;
  }

  getTimeouts() {
    return this.config.timeouts;
  }
}