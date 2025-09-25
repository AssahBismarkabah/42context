// Import generated version information
import { VERSION, PACKAGE_NAME, PACKAGE_DESCRIPTION } from './version-generated.js';

/**
 * Version management utility using build-time generated version information
 * This ensures version is always available without runtime file system lookups
 */
export class VersionManager {
  /**
   * Get the current version
   */
  static getVersion(): string {
    return VERSION;
  }

  /**
   * Get the package name
   */
  static getPackageName(): string {
    return PACKAGE_NAME;
  }

  /**
   * Get the full package description
   */
  static getDescription(): string {
    return PACKAGE_DESCRIPTION;
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