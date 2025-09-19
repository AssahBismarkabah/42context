

import type ParserType from 'tree-sitter';
const Parser = require('tree-sitter');
const TypeScript = require('tree-sitter-typescript');
const JavaScript = require('tree-sitter-javascript');
const Python = require('tree-sitter-python');
const Go = require('tree-sitter-go');
const Rust = require('tree-sitter-rust');
const Cpp = require('tree-sitter-cpp');
const Java = require('tree-sitter-java');

/**
 * Supported programming languages
 */
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'c'
  | 'java';

/**
 * Configuration for the code parser
 */
export interface CodeParserOptions {
  languages?: SupportedLanguage[];
  maxFileSize?: number;
  timeout?: number;
}

/**
 * Represents a semantic code chunk extracted from AST
 */
export interface CodeChunk {
  id: string;
  type: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type' | 'import' | 'export';
  name: string;
  content: string;
  filePath: string;
  language: SupportedLanguage;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  signature: string | undefined;
  documentation: string | undefined;
  dependencies: string[];
  metadata: Record<string, any> | undefined;
  timestamp: number;
}

/**
 * Tree-sitter based code parser for multiple programming languages
 */
export class CodeParser {
  private parsers: Map<SupportedLanguage, typeof Parser> = new Map();
  private readonly options: Required<CodeParserOptions>;

  constructor(options: CodeParserOptions = {}) {
    this.options = {
      languages: options.languages || ['typescript', 'javascript', 'python', 'go', 'rust', 'cpp'],
      maxFileSize: options.maxFileSize || 1024 * 1024, // 1MB default
      timeout: options.timeout || 5000 // 5 seconds default
    };

    this.initializeParsers();
  }

  /**
   * Initialize Tree-sitter parsers for supported languages
   */
  private initializeParsers(): void {
    for (const language of this.options.languages) {
      try {
        const parser = new Parser();
        const languageModule = this.getLanguageModule(language);
        
        if (languageModule) {
          parser.setLanguage(languageModule);
          this.parsers.set(language, parser);
          console.log(`Initialized Tree-sitter parser for ${language}`);
        }
      } catch (error) {
        console.error(`Failed to initialize parser for ${language}:`, error);
      }
    }
  }

  /**
   * Get the appropriate language module for Tree-sitter
   */
  private getLanguageModule(language: SupportedLanguage): any {
    switch (language) {
      case 'typescript':
        return TypeScript.typescript;
      case 'javascript':
        return JavaScript;
      case 'python':
        return Python;
      case 'go':
        return Go;
      case 'rust':
        return Rust;
      case 'cpp':
      case 'c':
        return Cpp;
      case 'java':
        return Java.java;
      default:
        console.warn(`No language module available for ${language}`);
        return null;
    }
  }

  /**
   * Detect programming language from file extension
   */
  detectLanguage(filePath: string): SupportedLanguage | null {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
        return 'javascript';
      case 'py':
      case 'pyx':
        return 'python';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'cpp':
      case 'cxx':
      case 'cc':
      case 'hpp':
        return 'cpp';
      case 'c':
      case 'h':
        return 'c';
      case 'java':
        return 'java';
      default:
        return null;
    }
  }

  /**
   * Parse a code file and extract semantic chunks
   */
  async parseFile(filePath: string, content: string): Promise<CodeChunk[]> {
    const language = this.detectLanguage(filePath);
    if (!language) {
      console.warn(`Unsupported language for file: ${filePath}`);
      return [];
    }

    const parser = this.parsers.get(language);
    if (!parser) {
      console.warn(`No parser available for language: ${language}`);
      return [];
    }

    // Check file size limit
    if (content.length > this.options.maxFileSize) {
      console.warn(`File too large, skipping: ${filePath}`);
      return [];
    }

    try {
      const startTime = Date.now();
      
      // Parse the code
      const tree = parser.parse(content);
      const rootNode = tree.rootNode;
      
      // Extract semantic chunks
      const chunks = this.extractSemanticChunks(rootNode, filePath, language, content);
      
      const parseTime = Date.now() - startTime;
      console.log(`Parsed ${filePath} in ${parseTime}ms, found ${chunks.length} chunks`);
      
      return chunks;
    } catch (error) {
      console.error(`Failed to parse file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extract semantic chunks from AST
   */
  private extractSemanticChunks(
    rootNode: ParserType.SyntaxNode,
    filePath: string, 
    language: SupportedLanguage,
    content: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Define node types to extract based on language
    const extractableTypes = this.getExtractableNodeTypes(language);
    
    // Traverse the AST
    this.traverseAST(rootNode, (node) => {
      if (extractableTypes.includes(node.type)) {
        const chunk = this.createCodeChunk(node, filePath, language, content);
        if (chunk) {
          chunks.push(chunk);
        }
      }
    });
    
    return chunks;
  }

  /**
   * Get extractable node types for each language
   */
  private getExtractableNodeTypes(language: SupportedLanguage): string[] {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return [
          'function_declaration',
          'method_definition',
          'class_declaration',
          'interface_declaration',
          'type_alias_declaration',
          'variable_declaration',
          'import_statement',
          'export_statement'
        ];
      case 'python':
        return [
          'function_definition',
          'class_definition',
          'import_statement',
          'import_from_statement',
          'assignment',
          'expression_statement'
        ];
      case 'go':
        return [
          'function_declaration',
          'method_declaration',
          'type_declaration',
          'import_declaration',
          'var_declaration'
        ];
      case 'rust':
        return [
          'function_item',
          'struct_item',
          'impl_item',
          'trait_item',
          'use_declaration',
          'let_declaration'
        ];
      case 'cpp':
      case 'c':
        return [
          'function_definition',
          'class_specifier',
          'struct_specifier',
          'namespace_definition',
          'using_declaration',
          'declaration'
        ];
      case 'java':
        return [
          'method_declaration',
          'constructor_declaration',
          'class_declaration',
          'interface_declaration',
          'enum_declaration',
          'field_declaration',
          'local_variable_declaration',
          'import_declaration',
          'package_declaration'
        ];
      default:
        return [];
    }
  }

  /**
   * Traverse AST and apply callback to each node
   */
  private traverseAST(node: ParserType.SyntaxNode, callback: (node: ParserType.SyntaxNode) => void): void {
    callback(node);
    for (const child of node.children) {
      this.traverseAST(child, callback);
    }
  }

  /**
   * Create a code chunk from an AST node
   */
  private createCodeChunk(
    node: ParserType.SyntaxNode,
    filePath: string, 
    language: SupportedLanguage,
    content: string
  ): CodeChunk | null {
    try {
      const nodeText = node.text;
      const startLine = node.startPosition.row;
      const endLine = node.endPosition.row;
      
      // Extract meaningful information based on node type
      const chunkType = this.determineChunkType(node.type);
      const name = this.extractNodeName(node, language);
      const signature = this.extractSignature(node, language);
      const documentation = this.extractDocumentation(node, content);
      const dependencies = this.extractDependencies(node, language);
      
      return {
        id: `${filePath}:${node.startPosition.row}:${node.startPosition.column}`,
        type: chunkType,
        name: name || 'anonymous',
        content: nodeText,
        filePath,
        language,
        startLine,
        endLine,
        startColumn: node.startPosition.column,
        endColumn: node.endPosition.column,
        signature,
        documentation,
        dependencies,
        metadata: undefined,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to create code chunk:', error);
      return null;
    }
  }

  /**
   * Determine chunk type based on node type and language
   */
  private determineChunkType(nodeType: string): CodeChunk['type'] {
    if (nodeType.includes('function') || nodeType.includes('method')) return 'function';
    if (nodeType.includes('class')) return 'class';
    if (nodeType.includes('interface')) return 'interface';
    if (nodeType.includes('type') || nodeType.includes('alias')) return 'type';
    if (nodeType.includes('import')) return 'import';
    if (nodeType.includes('export')) return 'export';
    if (nodeType.includes('variable') || nodeType.includes('declaration')) return 'variable';
    return 'function'; // Default fallback
  }

  /**
   * Extract node name from AST node
   */
  private extractNodeName(node: ParserType.SyntaxNode, language: SupportedLanguage): string {
    // Look for common name patterns in different languages
    const namePatterns = this.getNamePatterns(language);
    
    for (const pattern of namePatterns) {
      const nameNode = this.findNodeByType(node, pattern);
      if (nameNode) {
        return nameNode.text;
      }
    }
    
    return 'anonymous';
  }

  /**
   * Get name patterns for different languages
   */
  private getNamePatterns(language: SupportedLanguage): string[] {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return ['identifier', 'property_identifier', 'type_identifier'];
      case 'python':
        return ['identifier', 'function_name', 'class_name'];
      case 'go':
        return ['identifier', 'field_identifier', 'type_identifier'];
      case 'rust':
        return ['identifier', 'field_identifier', 'type_identifier'];
      case 'cpp':
      case 'c':
        return ['identifier', 'field_identifier', 'type_identifier'];
      case 'java':
        return [
          'identifier',
          'type_identifier',
          'method_name',
          'class_name',
          'interface_name',
          'enum_name'
        ];
      default:
        return ['identifier'];
    }
  }

  /**
   * Find node by type in AST subtree
   */
  private findNodeByType(node: ParserType.SyntaxNode, type: string): ParserType.SyntaxNode | null {
    if (node.type === type) {
      return node;
    }
    
    for (const child of node.children) {
      const found = this.findNodeByType(child, type);
      if (found) {
        return found;
      }
    }
    
    return null;
  }

  /**
   * Extract function/method signature
   */
  private extractSignature(node: ParserType.SyntaxNode, language: SupportedLanguage): string | undefined {
    // Look for parameters and return types
    const signatureParts: string[] = [];
    
    // Add node name
    const name = this.extractNodeName(node, language);
    if (name) {
      signatureParts.push(name);
    }
    
    // Add parameters
    const paramsNode = this.findNodeByType(node, 'parameters') ||
                      this.findNodeByType(node, 'formal_parameters') ||
                      this.findNodeByType(node, 'argument_list');
    
    if (paramsNode) {
      signatureParts.push(paramsNode.text);
    }
    
    return signatureParts.length > 0 ? signatureParts.join(' ') : undefined;
  }

  /**
   * Extract documentation/comments
   */
  private extractDocumentation(node: ParserType.SyntaxNode, content: string): string | undefined {
    // Look for comments before the node
    const startLine = node.startPosition.row;
    
    // Simple approach: look for comments in the lines before this node
    const lines = content.split('\n');
    const docLines: string[] = [];
    
    for (let i = startLine - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line) continue;
      
      // Check for different comment styles
      if (line.trim().startsWith('//') ||
          line.trim().startsWith('#') ||
          line.trim().startsWith('/*') ||
          line.trim().startsWith('*')) {
        docLines.unshift(line.trim());
      } else if (line.trim() === '') {
        continue; // Allow empty lines
      } else {
        break; // Stop at non-comment, non-empty line
      }
    }
    
    return docLines.length > 0 ? docLines.join('\n') : undefined;
  }

  /**
   * Extract dependencies (imports, includes, etc.)
   */
  private extractDependencies(node: ParserType.SyntaxNode, language: SupportedLanguage): string[] {
    const dependencies: string[] = [];
    
    // Find all identifier references in the current scope
    const identifierNodes = this.findAllNodesByType(node, 'identifier');
    const localIdentifiers = new Set<string>();
    
    // First, collect all local identifiers (function parameters, variables, etc.)
    this.collectLocalIdentifiers(node, language, localIdentifiers);
    
    // Then find external references (excluding local identifiers and built-ins)
    for (const identifierNode of identifierNodes) {
      const identifierName = identifierNode.text;
      
      // Skip local identifiers, built-ins, and common keywords
      if (this.isExternalReference(identifierName, language, localIdentifiers)) {
        dependencies.push(identifierName);
      }
    }
    
    // Also collect import statements
    const importPatterns = this.getImportPatterns(language);
    for (const pattern of importPatterns) {
      const importNodes = this.findAllNodesByType(node, pattern);
      for (const importNode of importNodes) {
        const importText = importNode.text;
        if (importText) {
          dependencies.push(importText);
        }
      }
    }
    
    // Remove duplicates and return
    return [...new Set(dependencies)];
  }

  /**
   * Collect local identifiers (parameters, variables, etc.) to exclude from dependencies
   */
  private collectLocalIdentifiers(node: ParserType.SyntaxNode, language: SupportedLanguage, localIdentifiers: Set<string>): void {
    // Find parameter declarations
    const paramPatterns = this.getParameterPatterns(language);
    for (const pattern of paramPatterns) {
      const paramNodes = this.findAllNodesByType(node, pattern);
      for (const paramNode of paramNodes) {
        const paramName = this.extractNodeName(paramNode, language);
        if (paramName && paramName !== 'anonymous') {
          localIdentifiers.add(paramName);
        }
      }
    }
    
    // Find variable declarations
    const varPatterns = this.getVariableDeclarationPatterns(language);
    for (const pattern of varPatterns) {
      const varNodes = this.findAllNodesByType(node, pattern);
      for (const varNode of varNodes) {
        const varName = this.extractNodeName(varNode, language);
        if (varName && varName !== 'anonymous') {
          localIdentifiers.add(varName);
        }
      }
    }
  }

  /**
   * Check if an identifier is an external reference (not local or built-in)
   */
  private isExternalReference(identifierName: string, language: SupportedLanguage, localIdentifiers: Set<string>): boolean {
    // Skip if it's a local identifier
    if (localIdentifiers.has(identifierName)) {
      return false;
    }
    
    // Skip built-in keywords and common names
    if (this.isBuiltInIdentifier(identifierName, language)) {
      return false;
    }
    
    // Skip very short identifiers (likely not meaningful)
    if (identifierName.length < 2) {
      return false;
    }
    
    // Skip numeric identifiers
    if (/^\d+$/.test(identifierName)) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if an identifier is a built-in keyword or common name
   */
  private isBuiltInIdentifier(identifierName: string, language: SupportedLanguage): boolean {
    const builtIns = this.getBuiltInIdentifiers(language);
    return builtIns.has(identifierName.toLowerCase());
  }

  /**
   * Get built-in identifiers for different languages
   */
  private getBuiltInIdentifiers(language: SupportedLanguage): Set<string> {
    const commonBuiltIns = new Set([
      'console', 'log', 'error', 'warn', 'info', 'debug',
      'true', 'false', 'null', 'undefined', 'this', 'self',
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'break', 'continue', 'return', 'function', 'class', 'interface',
      'public', 'private', 'protected', 'static', 'final', 'const', 'let', 'var'
    ]);
    
    switch (language) {
      case 'typescript':
      case 'javascript':
        return new Set([
          ...commonBuiltIns,
          'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math',
          'JSON', 'Promise', 'async', 'await', 'try', 'catch', 'throw', 'new',
          'typeof', 'instanceof', 'in', 'of', 'delete', 'void', 'yield'
        ]);
      case 'python':
        return new Set([
          ...commonBuiltIns,
          'print', 'len', 'range', 'str', 'int', 'float', 'bool', 'list', 'dict',
          'tuple', 'set', 'import', 'from', 'as', 'def', 'class', 'try', 'except',
          'finally', 'raise', 'with', 'pass', 'lambda', 'global', 'nonlocal'
        ]);
      case 'java':
        return new Set([
          ...commonBuiltIns,
          'System', 'String', 'Integer', 'Double', 'Boolean', 'ArrayList', 'HashMap',
          'package', 'import', 'extends', 'implements', 'abstract', 'synchronized',
          'volatile', 'transient', 'native', 'strictfp', 'assert'
        ]);
      default:
        return commonBuiltIns;
    }
  }

  /**
   * Get parameter patterns for different languages
   */
  private getParameterPatterns(language: SupportedLanguage): string[] {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return ['required_parameter', 'optional_parameter', 'rest_parameter'];
      case 'python':
        return ['parameters', 'default_parameter', 'typed_parameter'];
      case 'java':
        return ['formal_parameter', 'receiver_parameter'];
      case 'go':
        return ['parameter_declaration', 'variadic_parameter_declaration'];
      case 'rust':
        return ['function_parameter', 'self_parameter'];
      default:
        return [];
    }
  }

  /**
   * Get variable declaration patterns for different languages
   */
  private getVariableDeclarationPatterns(language: SupportedLanguage): string[] {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return ['variable_declarator', 'lexical_declaration'];
      case 'python':
        return ['assignment', 'expression_statement'];
      case 'java':
        return ['variable_declarator', 'local_variable_declaration'];
      case 'go':
        return ['var_declaration', 'short_var_declaration'];
      case 'rust':
        return ['let_declaration', 'const_item'];
      default:
        return [];
    }
  }

  /**
   * Get import patterns for different languages
   */
  private getImportPatterns(language: SupportedLanguage): string[] {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return ['import_statement', 'export_statement'];
      case 'python':
        return ['import_statement', 'import_from_statement'];
      case 'go':
        return ['import_declaration'];
      case 'rust':
        return ['use_declaration'];
      case 'cpp':
      case 'c':
        return ['preproc_include'];
      default:
        return [];
    }
  }

  /**
   * Find all nodes by type in AST subtree
   */
  private findAllNodesByType(node: ParserType.SyntaxNode, type: string): ParserType.SyntaxNode[] {
    const results: ParserType.SyntaxNode[] = [];
    
    if (node.type === type) {
      results.push(node);
    }
    
    for (const child of node.children) {
      results.push(...this.findAllNodesByType(child, type));
    }
    
    return results;
  }

  /**
   * Parse a code file incrementally (for file changes)
   */
  async parseFileIncremental(
    filePath: string,
    content: string,
    oldTree?: ParserType.Tree
  ): Promise<{ chunks: CodeChunk[]; tree: ParserType.Tree }> {
    const language = this.detectLanguage(filePath);
    if (!language) {
      return { chunks: [], tree: oldTree! };
    }

    const parser = this.parsers.get(language);
    if (!parser) {
      return { chunks: [], tree: oldTree! };
    }

    try {
      // Parse incrementally if we have an old tree
      const tree = oldTree
        ? parser.parse(content, oldTree)
        : parser.parse(content);
      
      const chunks = this.extractSemanticChunks(tree.rootNode, filePath, language, content);
      
      return { chunks, tree };
    } catch (error) {
      console.error(`Failed to parse file incrementally ${filePath}:`, error);
      return { chunks: [], tree: oldTree! };
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.parsers.has(language as SupportedLanguage);
  }

  /**
   * Get parser statistics
   */
  getStats(): {
    supportedLanguages: number;
    parsersInitialized: number;
    maxFileSize: number;
  } {
    return {
      supportedLanguages: this.options.languages.length,
      parsersInitialized: this.parsers.size,
      maxFileSize: this.options.maxFileSize
    };
  }
}

/**
 * Factory function to create a code parser instance
 */
function createCodeParser(options: CodeParserOptions = {}): CodeParser {
  return new CodeParser(options);
}

/**
 * CommonJS exports
 */
module.exports = CodeParser;
module.exports.CodeParser = CodeParser;
module.exports.createCodeParser = createCodeParser;

// Export types for CommonJS
module.exports.SupportedLanguage = {
  TypeScript: 'typescript',
  JavaScript: 'javascript',
  Python: 'python',
  Go: 'go',
  Rust: 'rust',
  Cpp: 'cpp',
  C: 'c',
  Java: 'java'
};

module.exports.CodeParserOptions = {};
module.exports.CodeChunk = {};
module.exports.ASTNodeInfo = {};