
/**
 * Memory Management Utility for 42Context Engine
 * Handles memory pressure, garbage collection, and resource optimization
 * for large-scale code indexing operations
 */

import { MemoryConfigManager } from './memory-config';

export interface MemoryManagerConfig {
  maxHeapSizeMB?: number;
  gcThresholdMB?: number;
  batchSizeReductionThresholdMB?: number;
  emergencyThresholdMB?: number;
  enableForceGC?: boolean;
  gcInterval?: number;
  memoryCheckInterval?: number;
}

export interface MemoryStats {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  arrayBuffersMB: number;
  timestamp: number;
}

export interface MemoryPressureResponse {
  shouldReduceBatchSize: boolean;
  shouldForceGC: boolean;
  shouldPause: boolean;
  severity: 'normal' | 'elevated' | 'critical' | 'emergency';
  recommendedAction: string;
}

/**
 * Memory Manager for handling large-scale embedding operations
 * Prevents segmentation faults and memory exhaustion
 */
export class MemoryManager {
  private config: Required<MemoryManagerConfig>;
  private lastGCTime: number = 0;
  private gcCount: number = 0;
  private memoryHistory: MemoryStats[] = [];
  private maxHistorySize: number = 100;

  constructor(config: MemoryManagerConfig = {}) {
    // Use centralized config as base, override with provided values
    const baseConfig = MemoryConfigManager.getInstance().getConfig();
    
    this.config = {
      maxHeapSizeMB: config.maxHeapSizeMB || baseConfig.thresholds.maxHeapSizeMB,
      gcThresholdMB: config.gcThresholdMB || baseConfig.thresholds.gcThresholdMB,
      batchSizeReductionThresholdMB: config.batchSizeReductionThresholdMB || baseConfig.thresholds.batchSizeReductionMB,
      emergencyThresholdMB: config.emergencyThresholdMB || baseConfig.thresholds.emergencyThresholdMB,
      enableForceGC: config.enableForceGC !== false, // Default true
      gcInterval: config.gcInterval || baseConfig.garbageCollection.intervalMs,
      memoryCheckInterval: config.memoryCheckInterval || 100 // Check every 100ms
    };
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage();
    const stats: MemoryStats = {
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      rssMB: Math.round(usage.rss / 1024 / 1024),
      externalMB: Math.round(usage.external / 1024 / 1024),
      arrayBuffersMB: Math.round(usage.arrayBuffers / 1024 / 1024),
      timestamp: Date.now()
    };

    // Add to history
    this.memoryHistory.push(stats);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    return stats;
  }

  /**
   * Check if we should perform memory management actions
   */
  checkMemoryPressure(): MemoryPressureResponse {
    const stats = this.getMemoryStats();
    const now = Date.now();

    // Determine severity level
    let severity: MemoryPressureResponse['severity'] = 'normal';
    let shouldReduceBatchSize = false;
    let shouldForceGC = false;
    let shouldPause = false;
    let recommendedAction = 'Continue normal processing';

    if (stats.heapUsedMB > this.config.emergencyThresholdMB) {
      severity = 'emergency';
      shouldReduceBatchSize = true;
      shouldForceGC = true;
      shouldPause = true;
      recommendedAction = 'EMERGENCY: Pause processing, force GC, reduce batch size significantly';
    } else if (stats.heapUsedMB > this.config.batchSizeReductionThresholdMB) {
      severity = 'critical';
      shouldReduceBatchSize = true;
      shouldForceGC = true;
      recommendedAction = 'CRITICAL: Reduce batch size and force GC';
    } else if (stats.heapUsedMB > this.config.gcThresholdMB) {
      severity = 'elevated';
      shouldForceGC = true;
      recommendedAction = 'ELEVATED: Force GC to prevent memory buildup';
    }

    // Check GC interval to prevent excessive GC calls
    if (shouldForceGC && (now - this.lastGCTime) < this.config.gcInterval) {
      shouldForceGC = false;
      if (severity === 'elevated') {
        severity = 'normal';
        recommendedAction = 'GC recently performed, continue normal processing';
      }
    }

    return {
      shouldReduceBatchSize,
      shouldForceGC,
      shouldPause,
      severity,
      recommendedAction
    };
  }

  /**
   * Force garbage collection if enabled and needed
   */
  async forceGarbageCollection(reason: string = 'manual'): Promise<void> {
    if (!this.config.enableForceGC || !global.gc) {
      return;
    }

    const beforeStats = this.getMemoryStats();
    console.log(`[MemoryManager] Forcing GC (${reason}) - Before: ${beforeStats.heapUsedMB}MB`);

    try {
      global.gc();
      this.gcCount++;
      this.lastGCTime = Date.now();

      // Wait a bit for GC to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterStats = this.getMemoryStats();
      const freedMB = beforeStats.heapUsedMB - afterStats.heapUsedMB;
      
      console.log(`[MemoryManager] GC completed - After: ${afterStats.heapUsedMB}MB, Freed: ${freedMB}MB`);
    } catch (error) {
      console.error('[MemoryManager] GC failed:', error);
    }
  }

  /**
   * Optimize batch size based on memory pressure
   */
  optimizeBatchSize(requestedSize: number): number {
    const pressure = this.checkMemoryPressure();
    let optimizedSize = requestedSize;

    if (pressure.severity === 'emergency') {
      optimizedSize = Math.max(1, Math.floor(requestedSize * 0.1)); // 90% reduction
    } else if (pressure.severity === 'critical') {
      optimizedSize = Math.max(1, Math.floor(requestedSize * 0.3)); // 70% reduction
    } else if (pressure.severity === 'elevated') {
      optimizedSize = Math.max(1, Math.floor(requestedSize * 0.7)); // 30% reduction
    }

    if (optimizedSize !== requestedSize) {
      console.log(`[MemoryManager] Batch size optimized: ${requestedSize} -> ${optimizedSize} (${pressure.severity})`);
    }

    return optimizedSize;
  }

  /**
   * Wait for memory pressure to reduce
   */
  async waitForMemoryPressureReduction(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const pressure = this.checkMemoryPressure();
      
      if (pressure.severity === 'normal') {
        return true;
      }

      if (pressure.shouldForceGC) {
        await this.forceGarbageCollection('pressure_reduction');
      }

      if (pressure.shouldPause) {
        console.log(`[MemoryManager] Pausing for memory pressure reduction (${pressure.severity})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return false; // Timeout
  }

  /**
   * Get memory usage trend
   */
  getMemoryTrend(): 'increasing' | 'stable' | 'decreasing' {
    if (this.memoryHistory.length < 3) {
      return 'stable';
    }

    const recent = this.memoryHistory.slice(-3);
    const avgRecent = recent.reduce((sum, stats) => sum + stats.heapUsedMB, 0) / recent.length;
    const older = this.memoryHistory.slice(-6, -3);
    const avgOlder = older.reduce((sum, stats) => sum + stats.heapUsedMB, 0) / older.length;

    const difference = avgRecent - avgOlder;
    
    if (difference > 50) return 'increasing';
    if (difference < -50) return 'decreasing';
    return 'stable';
  }

  /**
   * Get comprehensive memory report
   */
  getMemoryReport(): {
    current: MemoryStats;
    trend: string;
    pressure: MemoryPressureResponse;
    gcStats: {
      count: number;
      lastGCTime: number;
      timeSinceLastGC: number;
    };
    recommendations: string[];
  } {
    const current = this.getMemoryStats();
    const trend = this.getMemoryTrend();
    const pressure = this.checkMemoryPressure();
    const recommendations: string[] = [];
    
    if (pressure.severity !== 'normal') {
      recommendations.push(pressure.recommendedAction);
    }
    
    if (trend === 'increasing') {
      recommendations.push('Memory usage is trending upward - consider reducing batch sizes');
    }
    
    if (current.heapUsedMB > this.config.maxHeapSizeMB * 0.8) {
      recommendations.push('Memory usage approaching maximum - implement aggressive cleanup');
    }

    return {
      current,
      trend,
      pressure,
      gcStats: {
        count: this.gcCount,
        lastGCTime: this.lastGCTime,
        timeSinceLastGC: Date.now() - this.lastGCTime
      },
      recommendations
    };
  }

  /**
   * Reset memory manager state
   */
  reset(): void {
    this.memoryHistory = [];
    this.gcCount = 0;
    this.lastGCTime = 0;
  }
}
     