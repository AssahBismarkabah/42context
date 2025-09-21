
/**
 * Code Analysis Agent for PocketFlow integration
 */

import { BaseAgent } from './base-agent';
import { AgentContext, AgentResult, AgentConfig } from '../types';
import { CodeParser } from '../../code-parser';
import { CodeChunk } from '../../types';
import * as fs from 'fs/promises';

export interface AnalysisOptions {
  analysisType: 'complexity' | 'dependencies' | 'patterns' | 'security' | 'quality';
  includeRelatedFiles?: boolean;
  detailLevel?: 'brief' | 'detailed' | 'expert';
  focusAreas?: string[];
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  functionCount: number;
  classCount: number;
  maxNestingDepth: number;
  commentRatio: number;
}

export interface DependencyAnalysis {
  imports: string[];
  exports: string[];
  externalDependencies: string[];
  internalDependencies: string[];
  circularDependencies: string[];
  unusedDependencies: string[];
}

export interface PatternAnalysis {
  designPatterns: string[];
  codeSmells: string[];
  antiPatterns: string[];
  bestPractices: string[];
  architecturePatterns: string[];
}

export class CodeAnalysisAgent extends BaseAgent {
  private codeParser: CodeParser | null = null;
  private initialized: boolean = false;

  constructor(config: AgentConfig) {
    super(config);
  }

  /**
   * Initialize the code parser
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.codeParser = new CodeParser();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Code analysis initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Main execution logic for code analysis
   */
  protected async run(context: AgentContext): Promise<AgentResult> {
    this.validateContext(context);

    if (!this.initialized) {
      await this.initialize();
    }

    const { filePath, options = {} } = context.input;

    if (!filePath || typeof filePath !== 'string') {
      return this.createErrorResult('File path must be a non-empty string');
    }

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Parse the file
      const chunks = await this.codeParser!.parseFile(filePath, content);
      
      // Perform analysis based on type
      const analysisType = options.analysisType || 'complexity';
      let analysisResult: any;

      switch (analysisType) {
        case 'complexity':
          analysisResult = await this.analyzeComplexity(chunks, content);
          break;
        case 'dependencies':
          analysisResult = await this.analyzeDependencies(chunks, content);
          break;
        case 'patterns':
          analysisResult = await this.analyzePatterns(chunks, content);
          break;
        case 'security':
          analysisResult = await this.analyzeSecurity(chunks, content);
          break;
        case 'quality':
          analysisResult = await this.analyzeQuality(chunks, content);
          break;
        default:
          return this.createErrorResult(`Unknown analysis type: ${analysisType}`);
      }

      return this.createSuccessResult(analysisResult, {
        filePath,
        analysisType,
        chunkCount: chunks.length,
        fileSize: content.length
      });

    } catch (error) {
      return this.createErrorResult(
        `Code analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Analyze code complexity metrics
   */
  private async analyzeComplexity(chunks: CodeChunk[], content: string): Promise<ComplexityMetrics> {
    const functions = chunks.filter(chunk => chunk.type === 'function');
    const classes = chunks.filter(chunk => chunk.type === 'class');
    
    // Calculate cyclomatic complexity (simplified)
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);
    
    // Calculate cognitive complexity (simplified)
    const cognitiveComplexity = this.calculateCognitiveComplexity(content);
    
    // Count lines of code
    const linesOfCode = content.split('\n').length;
    
    // Calculate max nesting depth
    const maxNestingDepth = this.calculateMaxNestingDepth(content);
    
    // Calculate comment ratio
    const commentRatio = this.estimateCommentRatio(content);

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      linesOfCode,
      functionCount: functions.length,
      classCount: classes.length,
      maxNestingDepth,
      commentRatio
    };
  }

  /**
   * Analyze dependencies
   */
  private async analyzeDependencies(chunks: CodeChunk[], _content: string): Promise<DependencyAnalysis> {
    const imports = chunks.filter(chunk => chunk.type === 'import');
    const exports = chunks.filter(chunk => chunk.type === 'export');
    
    // Extract import statements
    const importStatements = imports.map(chunk => chunk.content);
    const exportStatements = exports.map(chunk => chunk.content);
    
    // Categorize dependencies (simplified implementation)
    const externalDeps = this.categorizeDependencies(importStatements, 'external');
    const internalDeps = this.categorizeDependencies(importStatements, 'internal');
    
    // For now, we'll use empty arrays for advanced dependency analysis
    // These can be implemented later with more sophisticated analysis
    const circularDeps: string[] = [];
    const unusedDeps: string[] = [];

    return {
      imports: importStatements,
      exports: exportStatements,
      externalDependencies: externalDeps,
      internalDependencies: internalDeps,
      circularDependencies: circularDeps,
      unusedDependencies: unusedDeps
    };
  }

  /**
   * Analyze code patterns
   */
  private async analyzePatterns(_chunks: CodeChunk[], _content: string): Promise<PatternAnalysis> {
    // Simplified pattern detection
    const designPatterns = this.detectPatterns(_content);
    const codeSmells = this.detectCodeSmells(_content);
    const antiPatterns = this.detectAntiPatterns(_content);
    const bestPractices = this.detectBestPractices(_content);
    const architecturePatterns = this.detectArchitecturePatterns(_content);

    return {
      designPatterns,
      codeSmells,
      antiPatterns,
      bestPractices,
      architecturePatterns
    };
  }

  /**
   * Analyze security issues
   */
  private async analyzeSecurity(_chunks: CodeChunk[], _content: string): Promise<any> {
    // Simplified security analysis
    const vulnerabilities = this.detectSecurityIssues(_content);
    const securityScore = this.estimateSecurityScore(vulnerabilities);
    const recommendations = this.generateSecurityRecommendations(vulnerabilities);

    return {
      vulnerabilities,
      securityScore,
      recommendations,
      severityLevels: this.categorizeSeverity(vulnerabilities)
    };
  }

  /**
   * Analyze code quality
   */
  private async analyzeQuality(chunks: CodeChunk[], content: string): Promise<any> {
    // Simplified quality assessment
    const complexity = await this.analyzeComplexity(chunks, content);
    const qualityMetrics = {
      complexity,
      maintainability: this.assessMaintainability(content, complexity),
      testability: this.assessTestability(content),
      performance: this.assessPerformance(content)
    };

    const overallScore = this.calculateOverallQualityScore(qualityMetrics);

    return {
      qualityScore: overallScore,
      metrics: qualityMetrics,
      improvementSuggestions: this.generateImprovementPlan(qualityMetrics)
    };
  }

  /**
   * Simplified cyclomatic complexity calculation
   */
  private calculateCyclomaticComplexity(content: string): number {
    // Count decision points (if, for, while, switch, catch, etc.)
    const decisionPoints = content.match(/\b(if|for|while|switch|catch|&&|\|\|)\b/g);
    return decisionPoints ? decisionPoints.length + 1 : 1;
  }

  /**
   * Simplified cognitive complexity calculation
   */
  private calculateCognitiveComplexity(content: string): number {
    // Basic heuristic based on nesting and decision points
    let complexity = 0;
    const lines = content.split('\n');
    let nestingLevel = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Increase nesting for opening braces
      if (trimmed.includes('{')) nestingLevel++;
      
      // Add complexity for decision points at current nesting level
      if (trimmed.match(/\b(if|for|while|switch)\b/)) {
        complexity += nestingLevel + 1;
      }
      
      // Decrease nesting for closing braces
      if (trimmed.includes('}')) nestingLevel = Math.max(0, nestingLevel - 1);
    }

    return complexity;
  }

  /**
   * Calculate maximum nesting depth
   */
  private calculateMaxNestingDepth(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.includes('{')) currentDepth++;
      if (trimmed.includes('}')) currentDepth = Math.max(0, currentDepth - 1);
      
      maxDepth = Math.max(maxDepth, currentDepth);
    }
    
    return maxDepth;
  }


  /**
   * Estimate comment ratio
   */
  private estimateCommentRatio(content: string): number {
    const lines = content.split('\n');
    const totalLines = lines.length;
    const commentLines = lines.filter(line => 
      line.trim().startsWith('//') || 
      line.trim().startsWith('/*') || 
      line.trim().startsWith('*') ||
      line.trim().startsWith('#')
    ).length;
    
    return totalLines > 0 ? commentLines / totalLines : 0;
  }

  /**
   * Categorize dependencies as internal or external
   */
  private categorizeDependencies(imports: string[], type: 'internal' | 'external'): string[] {
    return imports.filter(imp => {
      // Simple heuristic: relative paths are internal, absolute paths are external
      if (type === 'internal') {
        return imp.includes('./') || imp.includes('../');
      } else {
        return !imp.includes('./') && !imp.includes('../');
      }
    });
  }

  /**
   * Pattern detection
   */
  private detectPatterns(content: string): string[] {
    const patterns: string[] = [];
    
    // Simple pattern detection based on code structure
    if (content.includes('class') && content.includes('extends')) {
      patterns.push('Inheritance Pattern');
    }
    
    if (content.includes('interface') || content.includes('implements')) {
      patterns.push('Interface Pattern');
    }
    
    if (content.includes('function') && content.includes('return')) {
      patterns.push('Function Pattern');
    }
    
    return patterns;
  }

  /**
   * Code smell detection
   */
  private detectCodeSmells(content: string): string[] {
    const smells: string[] = [];
    const lines = content.split('\n');
    
    // Long method detection (simplified)
    const longFunctions = lines.filter(line => 
      line.length > 100 && (line.includes('function') || line.includes('=>'))
    );
    
    if (longFunctions.length > 0) {
      smells.push('Long Method');
    }
    
    // Large class detection (simplified)
    if (lines.length > 200) {
      smells.push('Large Class');
    }
    
    return smells;
  }

  /**
   * Anti-pattern detection
   */
  private detectAntiPatterns(content: string): string[] {
    const antiPatterns: string[] = [];
    
    // Magic numbers
    if (content.match(/\b\d{3,}\b/)) {
      antiPatterns.push('Magic Numbers');
    }
    
    // Deep nesting
    if (this.calculateMaxNestingDepth(content) > 4) {
      antiPatterns.push('Deep Nesting');
    }
    
    return antiPatterns;
  }

  /**
   * Best practices detection
   */
  private detectBestPractices(content: string): string[] {
    const practices: string[] = [];
    
    // Consistent naming (camelCase)
    if (content.match(/^[a-z][a-zA-Z0-9]*$/)) {
      practices.push('Consistent Naming');
    }
    
    // Proper indentation (basic check)
    const lines = content.split('\n');
    const properlyIndented = lines.filter(line => 
      line.match(/^\s{2,}.*$/) || line.trim() === ''
    );
    
    if (properlyIndented.length > lines.length * 0.8) {
      practices.push('Proper Indentation');
    }
    
    return practices;
  }

  /**
   * Architecture pattern detection
   */
  private detectArchitecturePatterns(content: string): string[] {
    const patterns: string[] = [];
    
    // MVC pattern indicators
    if (content.includes('Controller') || content.includes('Model') || content.includes('View')) {
      patterns.push('MVC Pattern');
    }
    
    // Singleton pattern
    if (content.includes('getInstance') || content.includes('static')) {
      patterns.push('Singleton Pattern');
    }
    
    return patterns;
  }

  /**
   * Security issue detection
   */
  private detectSecurityIssues(content: string): string[] {
    const issues: string[] = [];
    
    // SQL injection vulnerabilities
    if (content.match(/SELECT.*FROM.*WHERE.*\+/i) || content.match(/INSERT.*INTO.*\+/i)) {
      issues.push('Potential SQL Injection');
    }
    
    // XSS vulnerabilities
    if (content.match(/innerHTML.*\+/i) || content.match(/document\.write.*\+/i)) {
      issues.push('Potential XSS');
    }
    
    // Hardcoded credentials
    if (content.match(/password\s*=\s*["'][^"']*["']/i) || 
        content.match(/api[_-]?key\s*=\s*["'][^"']*["']/i)) {
      issues.push('Hardcoded Credentials');
    }
    
    return issues;
  }

  /**
   * Estimate security score
   */
  private estimateSecurityScore(vulnerabilities: string[]): number {
    const maxScore = 100;
    const penaltyPerIssue = 20;
    const score = Math.max(0, maxScore - (vulnerabilities.length * penaltyPerIssue));
    return Math.round(score);
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(vulnerabilities: string[]): string[] {
    const recommendations: string[] = [];
    
    if (vulnerabilities.includes('Potential SQL Injection')) {
      recommendations.push('Use parameterized queries to prevent SQL injection');
    }
    
    if (vulnerabilities.includes('Potential XSS')) {
      recommendations.push('Sanitize user input before rendering');
    }
    
    if (vulnerabilities.includes('Hardcoded Credentials')) {
      recommendations.push('Use environment variables for sensitive data');
    }
    
    return recommendations;
  }

  /**
   * Categorize severity
   */
  private categorizeSeverity(vulnerabilities: string[]): Record<string, number> {
    const severity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    vulnerabilities.forEach(vuln => {
      if (vuln.includes('SQL Injection') || vuln.includes('XSS')) {
        severity.critical++;
      } else if (vuln.includes('Hardcoded')) {
        severity.high++;
      } else {
        severity.medium++;
      }
    });
    
    return severity;
  }

  /**
   * Assess maintainability
   */
  private assessMaintainability(_content: string, complexity: ComplexityMetrics): number {
    let score = 100;
    
    // Penalize high complexity
    if (complexity.cyclomaticComplexity > 10) score -= 20;
    if (complexity.cognitiveComplexity > 15) score -= 15;
    
    // Penalize low comment ratio
    if (complexity.commentRatio < 0.1) score -= 10;
    
    // Penalize deep nesting
    if (complexity.maxNestingDepth > 3) score -= 15;
    
    return Math.max(0, score);
  }

  /**
   * Assess testability
   */
  private assessTestability(content: string): number {
    let score = 100;
    
    // Check for test-related keywords
    if (content.includes('test') || content.includes('Test')) {
      score += 10;
    }
    
    // Check for dependency injection patterns
    if (content.includes('inject') || content.includes('dependency')) {
      score += 15;
    }
    
    // Penalize tight coupling indicators
    if (content.includes('new ') && content.includes('import')) {
      score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess performance
   */
  private assessPerformance(content: string): number {
    let score = 100;
    
    // Check for performance-related patterns
    if (content.includes('cache') || content.includes('memo')) {
      score += 10;
    }
    
    // Penalize potential performance issues
    if (content.includes('for') && content.includes('length')) {
      score -= 5; // Potential loop optimization needed
    }
    
    if (content.match(/\bfor\b.*\bfor\b.*\bfor\b/)) {
      score -= 15; // Triple nested loops
    }
    
    return Math.max(0, score);
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallQualityScore(qualityMetrics: any): number {
    const weights = {
      complexity: 0.3,
      maintainability: 0.3,
      testability: 0.2,
      performance: 0.2
    };
    
    const complexityScore = Math.max(0, 100 - qualityMetrics.complexity.cyclomaticComplexity * 2);
    const maintainabilityScore = qualityMetrics.maintainability;
    const testabilityScore = qualityMetrics.testability;
    const performanceScore = qualityMetrics.performance;
    
    const overallScore = (
      complexityScore * weights.complexity +
      maintainabilityScore * weights.maintainability +
      testabilityScore * weights.testability +
      performanceScore * weights.performance
    );
    
    return Math.round(overallScore);
  }

  /**
   * Generate improvement plan
   */
  private generateImprovementPlan(qualityMetrics: any): string[] {
    const suggestions: string[] = [];
    
    // Add improvement suggestions based on quality metrics
    if (qualityMetrics.complexity.cyclomaticComplexity > 10) {
      suggestions.push('Consider breaking down complex functions into smaller ones');
    }
    
    if (qualityMetrics.complexity.cognitiveComplexity > 15) {
      suggestions.push('Simplify nested logic to reduce cognitive complexity');
    }
    
    if (qualityMetrics.maintainability < 70) {
      suggestions.push('Add more comments and documentation to improve maintainability');
    }
    
    if (qualityMetrics.testability < 70) {
      suggestions.push('Consider dependency injection to improve testability');
    }
    
    if (qualityMetrics.performance < 70) {
      suggestions.push('Review performance-critical sections for optimization');
    }
    
    if (qualityMetrics.complexity.commentRatio < 0.1) {
      suggestions.push('Add more inline comments to explain complex logic');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Code quality is good overall');
    }
    
    return suggestions;
  }
}
