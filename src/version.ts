import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Version management utility that reads version from package.json
 */
export class VersionManager {
  private static version: string | null = null;
  private static packageJson: any = null;

  /**
   * Load package.json and cache version
   */
  private static loadPackageJson(): void {
    if (this.packageJson) return;
    
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
      this.packageJson = JSON.parse(packageJsonContent);
      this.version = this.packageJson.version;
    } catch (error) {
      console.error('Failed to load package.json:', error);
      this.version = '0.1.0'; // fallback version
    }
  }

  /**
   * Get the current version from package.json
   */
  static getVersion(): string {
    if (!this.version) {
      this.loadPackageJson();
    }
    return this.version || '0.1.0';
  }

  /**
   * Get the package name from package.json
   */
  static getPackageName(): string {
    if (!this.packageJson) {
      this.loadPackageJson();
    }
    return this.packageJson?.name || 'mcp-local-context-engine';
  }

  /**
   * Get the full package description
   */
  static getDescription(): string {
    if (!this.packageJson) {
      this.loadPackageJson();
    }
    return this.packageJson?.description || 'MCP-Based Local Development Context Engine';
  }

  /**
   * Get 42context branding information
   */
  static getBranding(): {
    name: string;
    displayName: string;
    description: string;
    version: string;
  } {
    return {
      name: '42context',
      displayName: '42Context Engine',
      description: 'MCP-Based Semantic Code Search and Analysis Platform',
      version: this.getVersion()
    };
  }
}

export default VersionManager;