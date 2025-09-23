
import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Go from 'tree-sitter-go';
import Rust from 'tree-sitter-rust';
import { Logger } from '../core/logger';
import { CodeStorage } from '../storage/code-storage';
import { ChromaVectorStore } from '../ai/chroma-vector-store';
import { EmbeddingService } from '../ai/embedding-service';
import * as path from 'path';

const logger = new Logger();

export interface CrossReferenceAnalyzer {
  traceMethodCalls(params: {
    methodName: string;
    className?: string;
    filePath?: string;
    maxDepth?: number;
    direction: 'callers' | 'callees' | 'both';
  }): Promise<MethodCallGraph>;

  buildInheritanceTree(params: {
    className: string;
    includeInterfaces: boolean;
    includeAbstract: boolean;
  }): Promise<InheritanceTree>;

  analyzeDependencies(params: {
    target: string;
    dependencyTypes: ('import' | 'inheritance' | 'composition' | 'method-call')[];
    scope: 'file' | 'package' | 'global';
  }): Promise<DependencyGraph>;

  findImplementations(params: {
    interfaceName: string;
    includeSubinterfaces: boolean;
  }): Promise<Implementation[]>;

  semanticSearch(query: string, topK?: number, options?: any): Promise<any[]>;

  analyzeContext(filePath: string, analysisType: string, options?: any): Promise<any>;

  findRelatedCode(filePath: string, relationshipType: string, options?: any): Promise<any[]>;

  generateDocumentation(code: string, options?: any): Promise<string>;
}

export interface MethodCallGraph {
  root: MethodNode;
  nodes: Map<string, MethodNode>;
  edges: MethodEdge[];
  cycles: string[][];
  entryPoints: string[];
  terminationPoints: string[];
  metadata: {
    totalMethods: number;
    maxDepth: number;
    circularDependencies: number;
  };
}

export interface MethodNode {
  id: string;
  name: string;
  className: string;
  filePath: string;
  signature: string;
  modifiers: string[];
  calls: string[];
  calledBy: string[];
  complexity: number;
  linesOfCode: number;
  startLine: number;
  endLine: number;
  parameters: Parameter[];
  returnType: string;
  documentation?: string;
}

export interface MethodEdge {
  from: string;
  to: string;
  type: 'direct' | 'indirect' | 'callback' | 'event';
  weight: number;
  filePath: string;
  lineNumber: number;
}

export interface InheritanceTree {
  root: ClassNode;
  nodes: Map<string, ClassNode>;
  depth: number;
  interfaces: string[];
  abstractClasses: string[];
  concreteClasses: string[];
}

export interface ClassNode {
  id: string;
  name: string;
  filePath: string;
  type: 'class' | 'interface' | 'abstract' | 'enum';
  superclass: string | undefined;
  interfaces: string[];
  subclasses: string[];
  methods: MethodNode[];
  fields: FieldNode[];
  modifiers: string[];
  package: string;
  imports: string[];
}

export interface FieldNode {
  name: string;
  type: string;
  modifiers: string[];
  initialValue?: string;
}

export interface Parameter {
  name: string;
  type: string;
  optional: boolean;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  metrics: DependencyMetrics;
  cycles: string[][];
  hotspots: Hotspot[];
}

export interface DependencyNode {
  id: string;
  name: string;
  type: 'class' | 'interface' | 'package' | 'file';
  filePath: string;
  dependencies: string[];
  dependents: string[];
  complexity: number;
  stability: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'inheritance' | 'composition' | 'method-call';
  strength: number;
  filePath: string;
}

export interface DependencyMetrics {
  totalNodes: number;
  totalEdges: number;
  circularDependencies: number;
  averageCoupling: number;
  cohesionScore: number;
  stabilityIndex: number;
  abstractness: number;
  distanceFromMainSequence: number;
}

export interface Hotspot {
  nodeId: string;
  type: 'high-complexity' | 'high-coupling' | 'circular-dependency' | 'unstable';
  score: number;
  recommendations: string[];
}

export interface Implementation {
  interfaceName: string;
  implementationName: string;
  filePath: string;
  methods: MethodNode[];
  isAbstract: boolean;
  package: string;
}

export class CrossReferenceAnalyzerImpl implements CrossReferenceAnalyzer {
  private parsers: Map<string, Parser>;
  private vectorStore: ChromaVectorStore;
  private embeddingService: EmbeddingService;
  private methodIndex: Map<string, MethodNode>;
  private classIndex: Map<string, ClassNode>;

  private codeStorage: CodeStorage;

  constructor(
    codeStorage: CodeStorage,
    vectorStore: ChromaVectorStore,
    embeddingService: EmbeddingService
  ) {
    this.codeStorage = codeStorage;
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    
    // Initialize parsers for different languages
    this.parsers = new Map([
      ['java', new Parser()],
      ['typescript', new Parser()],
      ['javascript', new Parser()],
      ['python', new Parser()],
      ['go', new Parser()],
      ['rust', new Parser()]
    ]);

    // Set languages for parsers
    this.parsers.get('java')!.setLanguage(Java);
    this.parsers.get('typescript')!.setLanguage(TypeScript.typescript);
    this.parsers.get('javascript')!.setLanguage(TypeScript.typescript);
    this.parsers.get('python')!.setLanguage(Python);
    this.parsers.get('go')!.setLanguage(Go);
    this.parsers.get('rust')!.setLanguage(Rust);

    this.methodIndex = new Map();
    this.classIndex = new Map();

    this.loadIndexes();
  }

  async traceMethodCalls(params: {
    methodName: string;
    className?: string;
    filePath?: string;
    maxDepth?: number;
    direction: 'callers' | 'callees' | 'both';
  }): Promise<MethodCallGraph> {
    logger.info(`[traceMethodCalls] Tracing method calls for ${params.methodName}`, params);

    const maxDepth = params.maxDepth || 10;
    const visited = new Set<string>();
    const nodes = new Map<string, MethodNode>();
    const edges: MethodEdge[] = [];
    const cycles: string[][] = [];

    // Ensure indexes are populated
    await this.buildIndexes();

    // Find the root method
    const rootMethod = await this.findMethod(params.methodName, params.className, params.filePath);
    if (!rootMethod) {
      logger.error(`[traceMethodCalls] Root method ${params.methodName} not found`);
      throw new Error(`Method ${params.methodName} not found`);
    }
    logger.info(`[traceMethodCalls] Root method found: ${rootMethod.name}`);

    // Build the call graph
    await this.buildCallGraph(rootMethod, nodes, edges, visited, cycles, 0, maxDepth, params.direction);

    return {
      root: rootMethod,
      nodes,
      edges,
      cycles,
      entryPoints: this.findEntryPoints(nodes),
      terminationPoints: this.findTerminationPoints(nodes),
      metadata: {
        totalMethods: nodes.size,
        maxDepth: this.calculateMaxDepth(nodes),
        circularDependencies: cycles.length
      }
    };
  }

  async buildInheritanceTree(params: {
    className: string;
    includeInterfaces: boolean;
    includeAbstract: boolean;
  }): Promise<InheritanceTree> {
    logger.info(`Building inheritance tree for ${params.className}`, params);

    // Ensure indexes are populated
    await this.buildIndexes();

    // Try to find the class by exact name first, then by case-insensitive match
    let rootClass = this.classIndex.get(params.className);
    
    if (!rootClass) {
      // Try case-insensitive search
      for (const [className, classNode] of this.classIndex) {
        if (className && params.className && className.toLowerCase() === params.className.toLowerCase()) {
          rootClass = classNode;
          break;
        }
      }
    }
    
    if (!rootClass) {
      throw new Error(`Class ${params.className} not found`);
    }

    const nodes = new Map<string, ClassNode>();
    const interfaces: string[] = [];
    const abstractClasses: string[] = [];
    const concreteClasses: string[] = [];

    // Build the inheritance tree
    await this.buildInheritanceTreeRecursive(rootClass, nodes, params.includeInterfaces, params.includeAbstract);

    // Categorize classes
    for (const [_, node] of nodes) {
      if (node.type === 'interface') {
        interfaces.push(node.name);
      } else if (node.type === 'abstract') {
        abstractClasses.push(node.name);
      } else {
        concreteClasses.push(node.name);
      }
    }

    return {
      root: rootClass,
      nodes,
      depth: this.calculateTreeDepth(rootClass, nodes),
      interfaces,
      abstractClasses,
      concreteClasses
    };
  }

  async analyzeDependencies(params: {
    target: string;
    dependencyTypes: ('import' | 'inheritance' | 'composition' | 'method-call')[];
    scope: 'file' | 'package' | 'global';
  }): Promise<DependencyGraph> {
    logger.info(`Analyzing dependencies for ${params.target}`, params);

    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const cycles: string[][] = [];
    const hotspots: Hotspot[] = [];

    // Ensure indexes are populated
    await this.buildIndexes();

    // Find the target node
    const targetNode = await this.findDependencyNode(params.target);
    if (!targetNode) {
      throw new Error(`Target ${params.target} not found`);
    }

    // Analyze dependencies based on scope and types
    const analysisScope = await this.determineAnalysisScope(params.scope, targetNode);
    
    for (const node of analysisScope) {
      const dependencies = await this.findDependencies(node, params.dependencyTypes);
      const dependents = await this.findDependents(node, params.dependencyTypes);

      nodes.push({
        id: node.id,
        name: node.name,
        type: node.type,
        filePath: node.filePath,
        dependencies: dependencies.map(d => d.id),
        dependents: dependents.map(d => d.id),
        complexity: node.complexity || 1,
        stability: node.stability || 0.5
      });

      // Add edges
      for (const dep of dependencies) {
        edges.push({
          from: node.id,
          to: dep.id,
          type: 'inheritance', // Default type for dependencies
          strength: 1,
          filePath: node.filePath
        });
      }
    }

    // Detect cycles
    const detectedCycles = this.detectCycles(nodes, edges);
    cycles.push(...detectedCycles);

    // Identify hotspots
    const identifiedHotspots = this.identifyHotspots(nodes, edges, cycles);
    hotspots.push(...identifiedHotspots);

    return {
      nodes,
      edges,
      cycles,
      hotspots,
      metrics: this.calculateDependencyMetrics(nodes, edges, cycles)
    };
  }


  async findImplementations(params: {
    interfaceName: string;
    includeSubinterfaces: boolean;
  }): Promise<Implementation[]> {
    logger.info(`Finding implementations for interface ${params.interfaceName}`, params);

    // Ensure indexes are populated
    await this.buildIndexes();

    const implementations: Implementation[] = [];
    // Try to find the interface by exact name first, then by case-insensitive match
    let interfaceNode = this.classIndex.get(params.interfaceName);
    
    if (!interfaceNode) {
      // Try case-insensitive search
      for (const [className, classNode] of this.classIndex) {
        if (className && params.interfaceName && className.toLowerCase() === params.interfaceName.toLowerCase()) {
          interfaceNode = classNode;
          break;
        }
      }
    }

    if (!interfaceNode || interfaceNode.type !== 'interface') {
      throw new Error(`Interface ${params.interfaceName} not found`);
    }

    // Find direct implementations
    for (const [_, classNode] of this.classIndex) {
      if (classNode.interfaces.includes(params.interfaceName)) {
        implementations.push({
          interfaceName: params.interfaceName,
          implementationName: classNode.name,
          filePath: classNode.filePath,
          methods: classNode.methods,
          isAbstract: classNode.type === 'abstract',
          package: classNode.package
        });
      }
    }

    // Include subinterfaces if requested
    if (params.includeSubinterfaces) {
      const subinterfaces = this.findSubinterfaces(params.interfaceName);
      for (const subinterface of subinterfaces) {
        const subImplementations = await this.findImplementations({
          interfaceName: subinterface,
          includeSubinterfaces: true
        });
        implementations.push(...subImplementations);
      }
    }

    return implementations;
  }

  async semanticSearch(query: string, topK: number = 10, options: any = {}): Promise<any[]> {
    logger.info(`[semanticSearch] Searching for: "${query}"`, { query, topK, options });
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateTextEmbedding(query);
      
      // Search for similar vectors
      const searchResults = await this.vectorStore.searchSimilar(queryEmbedding, topK, options.language);
      
      logger.info(`[semanticSearch] Found ${searchResults.length} results`);
      return searchResults;
    } catch (error) {
      logger.error(`[semanticSearch] Search failed for query "${query}"`, error);
      throw new Error(`Semantic search failed: ${error}`);
    }
  }

  async analyzeContext(filePath: string, analysisType: string = 'general', options: any = {}): Promise<any> {
    logger.info(`[analyzeContext] Analyzing ${filePath} with type ${analysisType}`, { filePath, analysisType, options });
    
    try {
      // Get chunks for the file
      const chunks = await this.codeStorage.getChunksByFile(filePath);
      
      if (chunks.length === 0) {
        throw new Error(`No chunks found for file: ${filePath}`);
      }
      
      let analysis = {};
      
      switch (analysisType) {
        case 'complexity':
          analysis = this.calculateComplexity(chunks);
          break;
        case 'dependencies':
          analysis = this.analyzeFileDependencies(chunks);
          break;
        case 'patterns':
          analysis = this.identifyPatterns(chunks);
          break;
        case 'security':
          analysis = this.analyzeSecurity(chunks);
          break;
        default:
          analysis = this.generalAnalysis(chunks);
      }
      
      logger.info(`[analyzeContext] Analysis completed for ${filePath}`);
      return analysis;
    } catch (error) {
      logger.error(`[analyzeContext] Analysis failed for ${filePath}`, error);
      throw new Error(`Context analysis failed: ${error}`);
    }
  }

  async findRelatedCode(filePath: string, relationshipType: string = 'similar', options: any = {}): Promise<any[]> {
    logger.info(`[findRelatedCode] Finding related code for ${filePath} with type ${relationshipType}`, { filePath, relationshipType, options });
    
    try {
      // Get the target file's content/embedding
      const targetChunks = await this.codeStorage.getChunksByFile(filePath);
      
      if (targetChunks.length === 0) {
        throw new Error(`No chunks found for file: ${filePath}`);
      }
      
      let relatedFiles: any[] = [];
      
      switch (relationshipType) {
        case 'similar':
          relatedFiles = await this.findSimilarFiles(targetChunks);
          break;
        case 'dependent':
          relatedFiles = await this.findDependentFiles(targetChunks);
          break;
        case 'referenced':
          relatedFiles = await this.findReferencedFiles(targetChunks);
          break;
        default:
          relatedFiles = await this.findSimilarFiles(targetChunks);
      }
      
      logger.info(`[findRelatedCode] Found ${relatedFiles.length} related files`);
      return relatedFiles;
    } catch (error) {
      logger.error(`[findRelatedCode] Failed to find related code for ${filePath}`, error);
      throw new Error(`Find related code failed: ${error}`);
    }
  }

  async generateDocumentation(code: string, options: any = {}): Promise<string> {
    logger.info(`[generateDocumentation] Generating documentation for code snippet`, { codeLength: code.length, options });
    
    try {
      // Simple documentation generation based on code analysis
      const lines = code.split('\n').length;
      const hasFunctions = code.includes('function') || code.includes('=>') || code.includes('def ');
      const hasClasses = code.includes('class ') || code.includes('interface ');
      
      let documentation = '```\n' + code + '\n```\n\n';
      
      if (hasFunctions) {
        documentation += '## Functions\n';
        documentation += 'This code contains function definitions.\n\n';
      }
      
      if (hasClasses) {
        documentation += '## Classes\n';
        documentation += 'This code contains class definitions.\n\n';
      }
      
      documentation += `## Overview\n`;
      documentation += `- **Lines of Code**: ${lines}\n`;
      documentation += `- **Contains Functions**: ${hasFunctions ? 'Yes' : 'No'}\n`;
      documentation += `- **Contains Classes**: ${hasClasses ? 'Yes' : 'No'}\n\n`;
      
      documentation += `## Generated Documentation\n`;
      documentation += `This documentation was automatically generated by analyzing the code structure.\n`;
      
      logger.info(`[generateDocumentation] Documentation generated successfully`);
      return documentation;
    } catch (error) {
      logger.error(`[generateDocumentation] Failed to generate documentation`, error);
      throw new Error(`Documentation generation failed: ${error}`);
    }
  }

  // Helper methods for context analysis
  private calculateComplexity(chunks: any[]): any {
    let totalComplexity = 0;
    let functionCount = 0;
    let classCount = 0;
    
    for (const chunk of chunks) {
      if (chunk.type === 'function' || chunk.type === 'method') {
        functionCount++;
        // Simple complexity based on lines of code
        const complexity = Math.max(1, (chunk.endLine - chunk.startLine) / 10);
        totalComplexity += complexity;
      } else if (chunk.type === 'class' || chunk.type === 'interface') {
        classCount++;
      }
    }
    
    return {
      totalComplexity: Math.round(totalComplexity * 10) / 10,
      functionCount,
      classCount,
      averageComplexity: functionCount > 0 ? Math.round((totalComplexity / functionCount) * 10) / 10 : 0
    };
  }

  private analyzeFileDependencies(chunks: any[]): any {
    const dependencies = new Set<string>();
    
    for (const chunk of chunks) {
      if (chunk.dependencies) {
        for (const dep of chunk.dependencies) {
          dependencies.add(dep);
        }
      }
    }
    
    return {
      dependencyCount: dependencies.size,
      dependencies: Array.from(dependencies)
    };
  }

  private identifyPatterns(chunks: any[]): any {
    const patterns = {
      singleton: false,
      factory: false,
      observer: false,
      strategy: false
    };
    
    for (const chunk of chunks) {
      const content = chunk.content.toLowerCase();
      
      if (content.includes('getinstance') || content.includes('singleton')) {
        patterns.singleton = true;
      }
      if (content.includes('factory') || content.includes('create')) {
        patterns.factory = true;
      }
      if (content.includes('observer') || content.includes('notify')) {
        patterns.observer = true;
      }
      if (content.includes('strategy') || content.includes('algorithm')) {
        patterns.strategy = true;
      }
    }
    
    return patterns;
  }

  private analyzeSecurity(chunks: any[]): any {
    const securityIssues = [];
    
    for (const chunk of chunks) {
      const content = chunk.content.toLowerCase();
      
      if (content.includes('password') && !content.includes('hash')) {
        securityIssues.push('Potential plaintext password handling');
      }
      if (content.includes('eval(') || content.includes('exec(')) {
        securityIssues.push('Use of dangerous evaluation functions');
      }
      if (content.includes('sql') && content.includes('concat')) {
        securityIssues.push('Potential SQL injection vulnerability');
      }
    }
    
    return {
      securityIssues,
      securityScore: Math.max(0, 100 - (securityIssues.length * 20))
    };
  }

  private generalAnalysis(chunks: any[]): any {
    const types = new Set<string>();
    let totalLines = 0;
    
    for (const chunk of chunks) {
      types.add(chunk.type);
      totalLines += (chunk.endLine - chunk.startLine);
    }
    
    return {
      chunkTypes: Array.from(types),
      totalLines,
      chunkCount: chunks.length
    };
  }

  private async findSimilarFiles(targetChunks: any[]): Promise<any[]> {
    // Use semantic search to find similar files
    const targetContent = targetChunks.map(chunk => chunk.content || '').join('\n');
    if (!targetContent || !targetContent.trim()) {
      logger.warn('[findSimilarFiles] No valid content found in target chunks');
      return [];
    }
    const queryEmbedding = await this.embeddingService.generateTextEmbedding(targetContent);
    
    // Search for similar content across all files
    const allChunks = await this.codeStorage.searchChunks({});
    const similarFiles = new Map<string, number>();
    
    for (const chunk of allChunks) {
      if (chunk.filePath === targetChunks[0].filePath) continue; // Skip the target file itself
      
      // Skip chunks without valid content
      if (!chunk.content || typeof chunk.content !== 'string') {
        continue;
      }
      
      const chunkEmbedding = await this.embeddingService.generateTextEmbedding(chunk.content);
      const similarity = this.calculateCosineSimilarity(queryEmbedding, chunkEmbedding);
      
      if (similarity > 0.7) { // Threshold for similarity
        const currentSimilarity = similarFiles.get(chunk.filePath) || 0;
        similarFiles.set(chunk.filePath, Math.max(currentSimilarity, similarity));
      }
    }
    
    return Array.from(similarFiles.entries()).map(([filePath, similarity]) => ({
      filePath,
      similarity: Math.round(similarity * 100) / 100
    }));
  }

  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async findDependentFiles(targetChunks: any[]): Promise<any[]> {
    const dependencies = new Set<string>();
    
    for (const chunk of targetChunks) {
      if (chunk.dependencies) {
        for (const dep of chunk.dependencies) {
          dependencies.add(dep);
        }
      }
    }
    
    return Array.from(dependencies).map(dep => ({
      filePath: dep,
      dependencyType: 'direct'
    }));
  }

  private async findReferencedFiles(targetChunks: any[]): Promise<any[]> {
    const referencedFiles = new Set<string>();
    
    for (const chunk of targetChunks) {
      // Look for import statements or file references
      const importMatches = chunk.content.match(/from\s+['"]([^'"]+)['"]/g);
      if (importMatches) {
        for (const match of importMatches) {
          const filePath = match.replace(/from\s+['"]([^'"]+)['"]/, '$1');
          referencedFiles.add(filePath);
        }
      }
    }
    
    return Array.from(referencedFiles).map(filePath => ({
      filePath,
      referenceType: 'import'
    }));
  }

  // Debug method to inspect indexes
  public getDebugInfo(): {
    methodCount: number;
    classCount: number;
    classes: Array<{name: string, type: string, interfaces: string[], filePath: string}>;
    interfaces: Array<{name: string, implementations: string[]}>;
  } {
    const classes = Array.from(this.classIndex.entries()).map(([name, node]) => ({
      name,
      type: node.type,
      interfaces: node.interfaces,
      filePath: node.filePath
    }));

    const interfaces = classes
      .filter(cls => cls.type === 'interface')
      .map(iface => ({
        name: iface.name,
        implementations: classes
          .filter(cls => cls.interfaces.includes(iface.name))
          .map(cls => cls.name)
      }));

    return {
      methodCount: this.methodIndex.size,
      classCount: this.classIndex.size,
      classes,
      interfaces
    };
  }

  // Private helper methods
  private async findMethod(methodName: string, className?: string, filePath?: string): Promise<MethodNode | null> {
    logger.info(`[findMethod] Searching for method: ${methodName}, className: ${className}, filePath: ${filePath}`);
    // Search in method index first
    for (const [_id, method] of this.methodIndex) {
      if (method.name && method.name === methodName) {
        if (className && method.className !== className) {
          // Try case-insensitive and filename-based matching
          const normalizedClassName = className.toLowerCase().replace(/-/g, '');
          const normalizedMethodClassName = method.className.toLowerCase().replace(/-/g, '');
          if (normalizedMethodClassName !== normalizedClassName) continue;
        }
        if (filePath && method.filePath !== filePath) continue;
        logger.info(`[findMethod] Found exact match: ${method.name}`);
        return method;
      }
    }

    // Also search by partial match if exact match not found
    for (const [_id, method] of this.methodIndex) {
      if (method.name && methodName && method.name.toLowerCase() === methodName.toLowerCase()) {
        if (className) {
          const normalizedClassName = className.toLowerCase().replace(/-/g, '');
          const normalizedMethodClassName = method.className.toLowerCase().replace(/-/g, '');
          if (normalizedMethodClassName !== normalizedClassName) continue;
        }
        if (filePath && method.filePath !== filePath) continue;
        logger.info(`[findMethod] Found partial match: ${method.name}`);
        return method;
      }
    }

    // If not found, search in vector store using embedding
    const queryText = `method ${methodName}${className ? ` in class ${className}` : ''}`;
    const queryEmbedding = await this.embeddingService.generateTextEmbedding(queryText);
    const results = await this.vectorStore.searchSimilar(queryEmbedding, 10);

    for (const result of results) {
      if (result.type === 'method' && result.content.includes(methodName)) {
        // Extract metadata from the search result
        if (className && !result.content.includes(className)) continue;
        if (filePath && result.filePath !== filePath) continue;
        
        return {
          id: result.id,
          name: methodName,
          className: className || 'Unknown',
          filePath: result.filePath,
          signature: '',
          modifiers: [],
          calls: [],
          calledBy: [],
          complexity: 1,
          linesOfCode: result.lineEnd - result.lineStart,
          startLine: result.lineStart,
          endLine: result.lineEnd,
          parameters: [],
          returnType: 'void',
          documentation: result.content
        };
      }
    }

    logger.warn(`[findMethod] Method not found: ${methodName}`);
    return null;
  }

  private async buildCallGraph(
    rootMethod: MethodNode,
    nodes: Map<string, MethodNode>,
    edges: MethodEdge[],
    visited: Set<string>,
    cycles: string[][],
    currentDepth: number,
    maxDepth: number,
    direction: 'callers' | 'callees' | 'both'
  ): Promise<void> {
    if (currentDepth >= maxDepth || visited.has(rootMethod.id)) {
      return;
    }

    visited.add(rootMethod.id);
    nodes.set(rootMethod.id, rootMethod);

    if (direction === 'callees' || direction === 'both') {
      // Find methods called by this method
      for (const call of rootMethod.calls) {
        logger.info(`[buildCallGraph] Checking call: ${call}`);
        if (typeof call === 'string') {
          const calledMethod = await this.findMethod(call);
          if (calledMethod) {
            logger.info(`[buildCallGraph] Found called method: ${calledMethod.name}`);
            edges.push({
              from: rootMethod.id,
              to: calledMethod.id,
              type: 'direct',
              weight: 1,
              filePath: rootMethod.filePath,
              lineNumber: 0
            });
            await this.buildCallGraph(calledMethod, nodes, edges, visited, cycles, currentDepth + 1, maxDepth, direction);
          }
        } else {
          logger.warn(`[buildCallGraph] Invalid call in calls array: ${call}`);
        }
      }
    }

    if (direction === 'callers' || direction === 'both') {
      // Find methods that call this method
      for (const caller of rootMethod.calledBy) {
        logger.info(`[buildCallGraph] Checking caller: ${caller}`);
        if (typeof caller === 'string') {
          const callingMethod = await this.findMethod(caller);
          if (callingMethod) {
            logger.info(`[buildCallGraph] Found calling method: ${callingMethod.name}`);
            edges.push({
              from: callingMethod.id,
              to: rootMethod.id,
              type: 'direct',
              weight: 1,
              filePath: callingMethod.filePath,
              lineNumber: 0
            });
            await this.buildCallGraph(callingMethod, nodes, edges, visited, cycles, currentDepth + 1, maxDepth, direction);
          }
        } else {
          logger.warn(`[buildCallGraph] Invalid caller in calledBy array: ${caller}`);
        }
      }
    }
  }

  private findEntryPoints(nodes: Map<string, MethodNode>): string[] {
    const entryPoints: string[] = [];
    for (const [id, node] of nodes) {
      if (node.calledBy.length === 0) {
        entryPoints.push(id);
      }
    }
    return entryPoints;
  }

  private findTerminationPoints(nodes: Map<string, MethodNode>): string[] {
    const terminationPoints: string[] = [];
    for (const [id, node] of nodes) {
      if (node.calls.length === 0) {
        terminationPoints.push(id);
      }
    }
    return terminationPoints;
  }

  private calculateMaxDepth(nodes: Map<string, MethodNode>): number {
    let maxDepth = 0;
    for (const [_, node] of nodes) {
      if (node.complexity > maxDepth) {
        maxDepth = node.complexity;
      }
    }
    return maxDepth;
  }

  private async buildInheritanceTreeRecursive(
    currentClass: ClassNode,
    nodes: Map<string, ClassNode>,
    includeInterfaces: boolean,
    includeAbstract: boolean
  ): Promise<void> {
    nodes.set(currentClass.id, currentClass);

    // Find subclasses
    for (const [_, classNode] of this.classIndex) {
      if (classNode.superclass === currentClass.name) {
        if ((classNode.type === 'interface' && includeInterfaces) ||
            (classNode.type === 'abstract' && includeAbstract) ||
            classNode.type === 'class') {
          await this.buildInheritanceTreeRecursive(classNode, nodes, includeInterfaces, includeAbstract);
        }
      }
    }
  }

  private calculateTreeDepth(rootClass: ClassNode, nodes: Map<string, ClassNode>): number {
    let maxDepth = 0;
    for (const [_, node] of nodes) {
      if (node.superclass === rootClass.name) {
        const depth = this.calculateTreeDepth(node, nodes) + 1;
        if (depth > maxDepth) {
          maxDepth = depth;
        }
      }
    }
    return maxDepth;
  }

  private async findDependencyNode(target: string): Promise<DependencyNode | null> {
    // Search in class index first
    for (const [_, classNode] of this.classIndex) {
      if (classNode.name === target) {
        return {
          id: classNode.id,
          name: classNode.name,
          type: classNode.type === 'interface' ? 'interface' : 'class',
          filePath: classNode.filePath,
          dependencies: classNode.interfaces,
          dependents: classNode.subclasses,
          complexity: classNode.methods.length,
          stability: 0.5
        };
      }
    }

    return null;
  }

  private async determineAnalysisScope(scope: string, targetNode: DependencyNode): Promise<DependencyNode[]> {
    const scopeNodes: DependencyNode[] = [targetNode];

    if (scope === 'package') {
      // Find all nodes in the same package
      for (const [_, classNode] of this.classIndex) {
        if (classNode.package === targetNode.name) {
          scopeNodes.push({
            id: classNode.id,
            name: classNode.name,
            type: classNode.type === 'interface' ? 'interface' : 'class',
            filePath: classNode.filePath,
            dependencies: classNode.interfaces,
            dependents: classNode.subclasses,
            complexity: classNode.methods.length,
            stability: 0.5
          });
        }
      }
    } else if (scope === 'global') {
      // Include all nodes
      for (const [_, classNode] of this.classIndex) {
        scopeNodes.push({
          id: classNode.id,
          name: classNode.name,
          type: classNode.type === 'interface' ? 'interface' : 'class',
          filePath: classNode.filePath,
          dependencies: classNode.interfaces,
          dependents: classNode.subclasses,
          complexity: classNode.methods.length,
          stability: 0.5
        });
      }
    }

    return scopeNodes;
  }

  private findSubinterfaces(interfaceName: string): string[] {
    const subinterfaces: string[] = [];
    
    for (const [_, classNode] of this.classIndex) {
      if (classNode.type === 'interface' && classNode.interfaces.includes(interfaceName)) {
        subinterfaces.push(classNode.name);
      }
    }

    return subinterfaces;
  }

  private async findDependencies(node: DependencyNode, _dependencyTypes: string[]): Promise<DependencyNode[]> {
    const dependencies: DependencyNode[] = [];
    
    for (const depName of node.dependencies) {
      const depNode = await this.findDependencyNode(depName);
      if (depNode) {
        dependencies.push(depNode);
      }
    }

    return dependencies;
  }

  private async findDependents(node: DependencyNode, _dependencyTypes: string[]): Promise<DependencyNode[]> {
    const dependents: DependencyNode[] = [];
    
    for (const depName of node.dependents) {
      const depNode = await this.findDependencyNode(depName);
      if (depNode) {
        dependents.push(depNode);
      }
    }

    return dependents;
  }

  private detectCycles(nodes: DependencyNode[], edges: DependencyEdge[]): string[][] {
    // Simple cycle detection using DFS
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      // Find all edges from this node
      const outgoingEdges = edges.filter(edge => edge.from === nodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.to, [...path]);
      }

      recursionStack.delete(nodeId);
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  private identifyHotspots(nodes: DependencyNode[], edges: DependencyEdge[], cycles: string[][]): Hotspot[] {
    const hotspots: Hotspot[] = [];

    for (const node of nodes) {
      const complexity = node.complexity;
      const coupling = edges.filter(edge => edge.from === node.id || edge.to === node.id).length;
      const isInCycle = cycles.some(cycle => cycle.includes(node.id));

      if (complexity > 10) {
        hotspots.push({
          nodeId: node.id,
          type: 'high-complexity',
          score: complexity,
          recommendations: ['Consider breaking down this component into smaller parts']
        });
      }

      if (coupling > 5) {
        hotspots.push({
          nodeId: node.id,
          type: 'high-coupling',
          score: coupling,
          recommendations: ['Consider reducing dependencies to improve maintainability']
        });
      }

      if (isInCycle) {
        hotspots.push({
          nodeId: node.id,
          type: 'circular-dependency',
          score: 1,
          recommendations: ['Break the circular dependency by introducing an interface or moving shared code']
        });
      }
    }

    return hotspots;
  }

  private calculateDependencyMetrics(nodes: DependencyNode[], edges: DependencyEdge[], cycles: string[][]): DependencyMetrics {
    const totalNodes = nodes.length;
    const totalEdges = edges.length;
    const circularDependencies = cycles.length;
    const averageCoupling = totalEdges / totalNodes;
    const stabilityIndex = 1 - (circularDependencies / totalNodes);
    const abstractness = nodes.filter(n => n.type === 'interface').length / totalNodes;

    return {
      totalNodes,
      totalEdges,
      circularDependencies,
      averageCoupling,
      cohesionScore: 0.5, // Placeholder
      stabilityIndex,
      abstractness,
      distanceFromMainSequence: Math.abs(abstractness + stabilityIndex - 1)
    };
  }

  // Index building methods
  private async buildIndexes(): Promise<void> {
    const loaded = await this.loadIndexes();
    if (loaded) {
      logger.info('Cross-reference indexes loaded from disk.');
      return;
    }

    logger.info('Building cross-reference indexes...');
    
    try {
      // Get all files from code storage by searching for all chunks and extracting unique file paths
      logger.info('Searching for chunks in code storage...');
      const allChunks = await this.codeStorage.searchChunks({});
      logger.info(`Found ${allChunks.length} total chunks in code storage`);
      
      if (allChunks.length === 0) {
        logger.warn('No chunks found in code storage. The cross-reference analyzer requires code to be indexed first.');
        logger.info('Available chunk types in storage:');
        const sampleChunks = await this.codeStorage.searchChunks({ limit: 5 });
        sampleChunks.forEach(chunk => {
          logger.info(`  - ${chunk.type}: ${chunk.name} in ${chunk.filePath}`);
        });
        return;
      }
      
      // Log sample chunks for debugging
      logger.info('Sample chunks found:');
      allChunks.slice(0, 5).forEach(chunk => {
        logger.info(`  - ${chunk.type}: ${chunk.name} in ${chunk.filePath}`);
      });
      
      const allFilePaths = [...new Set(allChunks.map(chunk => chunk.filePath))];
      logger.info(`Found ${allFilePaths.length} unique file paths`);
      
      for (const filePath of allFilePaths) {
        logger.debug(`Indexing file: ${filePath}`);
        await this.indexFile(filePath);
      }
      
      logger.info(`Built indexes: ${this.methodIndex.size} methods, ${this.classIndex.size} classes`);
      
      // Log sample indexed items
      if (this.methodIndex.size > 0) {
        logger.info('Sample methods in index:');
        const methodEntries = Array.from(this.methodIndex.entries()).slice(0, 3);
        methodEntries.forEach(([id, method]) => {
          logger.info(`  - ${method.name} in ${method.className} (${id})`);
        });
      }
      
      if (this.classIndex.size > 0) {
        logger.info('Sample classes in index:');
        const classEntries = Array.from(this.classIndex.entries()).slice(0, 3);
        classEntries.forEach(([name, cls]) => {
          logger.info(`  - ${name} (${cls.type})`);
        });
      }

      await this.saveIndexes();

    } catch (error) {
      logger.error('Failed to build indexes', error);
      throw new Error(`Failed to build indexes: ${error}`);
    }
  }

  private async indexFile(filePath: string): Promise<void> {
    try {
      // Get chunks for this file from code storage instead of re-parsing
      const fileChunks = await this.codeStorage.getChunksByFile(filePath);
      
      if (fileChunks.length === 0) {
        logger.debug(`No chunks found for file ${filePath}`);
        return;
      }

      const language = this.detectLanguage(filePath);
      if (!language) {
        return;
      }

      // First pass: build class index and map class names to their chunks
      const classMap = new Map<string, any>();
      for (const chunk of fileChunks) {
        if ((chunk.type === 'class' || chunk.type === 'interface') && typeof chunk.name === 'string') {
          // Skip chunks without metadata if we already have one with metadata
          if (!chunk.metadata && classMap.has(chunk.name)) {
            continue;
          }
          
          const classId = `${filePath}:${chunk.name}`;
          const classNode: ClassNode = {
            id: classId,
            name: chunk.name,
            filePath: chunk.filePath,
            type: chunk.type === 'interface' ? 'interface' : 'class',
            superclass: chunk.metadata?.superclass,
            interfaces: chunk.metadata?.interfaces || [],
            subclasses: [],
            methods: [],
            fields: chunk.metadata?.fields || [],
            modifiers: chunk.metadata?.modifiers || [],
            package: this.extractPackage(chunk.filePath, language),
            imports: chunk.metadata?.imports || []
          };
          this.classIndex.set(chunk.name, classNode);
          classMap.set(chunk.name, chunk);
        }
      }

      // Second pass: build method index with proper class associations
      for (const chunk of fileChunks) {
        if ((chunk.type === 'function' || chunk.type === 'method') && typeof chunk.name === 'string') {
          // Find the containing class for this method
          let className = this.extractClassNameFromChunk(chunk);
          
          // If no class name found, try to find the class that contains this method by line numbers
          if (!className || className === 'Unknown') {
            for (const [classNameKey, classChunk] of classMap) {
              if (chunk.startLine >= classChunk.startLine && chunk.endLine <= classChunk.endLine) {
                className = classNameKey;
                break;
              }
            }
          }
          
          const methodId = `${filePath}:${chunk.name}`;
          const methodNode: MethodNode = {
            id: methodId,
            name: chunk.name,
            className: className || 'Unknown',
            filePath: chunk.filePath,
            signature: chunk.signature || chunk.content.substring(0, 100),
            modifiers: chunk.metadata?.modifiers || [],
            calls: (chunk.dependencies || []).filter((d: any) => typeof d === 'string'),
            calledBy: [],
            complexity: chunk.metadata?.complexity || 1,
            linesOfCode: chunk.endLine - chunk.startLine,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            parameters: chunk.metadata?.parameters || [],
            returnType: chunk.metadata?.returnType || 'void',
            documentation: chunk.documentation || ''
          };
          this.methodIndex.set(methodId, methodNode);
          
          // Add method to class node
          if (className && this.classIndex.has(className)) {
            this.classIndex.get(className)!.methods.push(methodNode);
          }
        }
      }
      
      logger.debug(`Indexed ${fileChunks.length} chunks from ${filePath}`);
    } catch (error) {
      logger.warn(`Failed to index file ${filePath}`, error);
    }
  }

  private detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.java': 'java',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust'
    };
    
    return languageMap[ext] || null;
  }

  private extractClassNameFromChunk(chunk: any): string | null {
    // Extract class name from chunk metadata or file path
    if (chunk.metadata?.className) {
      return chunk.metadata.className;
    }
    
    // For class chunks, use the chunk name directly
    if ((chunk.type === 'class' || chunk.type === 'interface') && chunk.name) {
      return chunk.name;
    }
    
    // Try to extract from file path
    const pathParts = chunk.filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    return fileName.replace(/\.(java|ts|js|py|go|rs)$/, '');
  }



  private extractPackage(filePath: string, _language: string): string {
    // Extract package from file path or file content
    return path.dirname(filePath);
  }

  private getIndexPath(indexName: string): string {
    return path.join(this.codeStorage.getStoragePath(), `${indexName}.json`);
  }

  private async saveIndexes(): Promise<void> {
    logger.info('Saving cross-reference indexes to disk...');
    try {
      const fs = require('fs').promises;
      const methodIndexPath = this.getIndexPath('methodIndex');
      const classIndexPath = this.getIndexPath('classIndex');

      const methodIndexData = JSON.stringify(Array.from(this.methodIndex.entries()));
      const classIndexData = JSON.stringify(Array.from(this.classIndex.entries()));

      await fs.writeFile(methodIndexPath, methodIndexData);
      await fs.writeFile(classIndexPath, classIndexData);

      logger.info(`Indexes saved successfully to ${this.codeStorage.getStoragePath()}`);
    } catch (error) {
      logger.error('Failed to save indexes', error);
    }
  }

  private async loadIndexes(): Promise<boolean> {
    logger.debug('Attempting to load cross-reference indexes from disk...');
    try {
      const fs = require('fs').promises;
      const methodIndexPath = this.getIndexPath('methodIndex');
      const classIndexPath = this.getIndexPath('classIndex');

      if (!require('fs').existsSync(methodIndexPath) || !require('fs').existsSync(classIndexPath)) {
        logger.debug('Index files not found.');
        return false;
      }

      const methodIndexData = await fs.readFile(methodIndexPath, 'utf-8');
      const classIndexData = await fs.readFile(classIndexPath, 'utf-8');

      this.methodIndex = new Map(JSON.parse(methodIndexData));
      this.classIndex = new Map(JSON.parse(classIndexData));

      logger.info(`Loaded ${this.methodIndex.size} methods and ${this.classIndex.size} classes from indexes.`);
      return this.methodIndex.size > 0 && this.classIndex.size > 0;
    } catch (error) {
      logger.error('Failed to load indexes', error);
      return false;
    }
  }
}
