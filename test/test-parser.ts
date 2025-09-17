const { CodeParser } = require('../src/code-parser');
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

async function testParser() {
  console.log(' Testing Tree-sitter Code Parser...\n');
  
  // Create test directory
  const testDir = join(__dirname, 'parser-test');
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {}
  mkdirSync(testDir, { recursive: true });
  
  // Create test files for different languages
  const testFiles = {
    'test.ts': `
interface User {
  id: number;
  name: string;
}

class UserService {
  private users: User[] = [];
  
  addUser(user: User): void {
    this.users.push(user);
  }
  
  getUser(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }
}
`,
    'test.js': `
function calculateSum(a, b) {
  return a + b;
}

class Calculator {
  constructor() {
    this.result = 0;
  }
  
  add(value) {
    this.result += value;
    return this;
  }
  
  getResult() {
    return this.result;
  }
}
`,
    'test.java': `
public class BankAccount {
  private double balance;
  private String accountNumber;
  
  public BankAccount(String accountNumber, double initialBalance) {
    this.accountNumber = accountNumber;
    this.balance = initialBalance;
  }
  
  public void deposit(double amount) {
    if (amount > 0) {
      balance += amount;
    }
  }
  
  public double getBalance() {
    return balance;
  }
}
`,
    'test.py': `
def fibonacci(n):
  if n <= 1:
    return n
  return fibonacci(n-1) + fibonacci(n-2)

class DataProcessor:
  def __init__(self, data):
    self.data = data
  
  def process(self):
    return [x * 2 for x in self.data]
`
  };
  
  // Write test files
  for (const [filename, content] of Object.entries(testFiles)) {
    writeFileSync(join(testDir, filename), content);
  }
  
  // Initialize parser
  const parser = new CodeParser({
    languages: ['typescript', 'javascript', 'java', 'python']
  });
  
  console.log(' Parsing test files...\n');
  
  // Parse each file
  for (const [filename, content] of Object.entries(testFiles)) {
    console.log(` Parsing ${filename}:`);
    const filePath = join(testDir, filename);
    const language = parser.detectLanguage(filePath);
    
    if (language) {
      console.log(`   Language detected: ${language}`);
      
      try {
        const chunks = await parser.parseFile(filePath, content);
        console.log(`   Found ${chunks.length} code chunks:`);
        
        chunks.forEach((chunk: any, index: number) => {
          console.log(`   ${index + 1}. ${chunk.type}: ${chunk.name} (${chunk.startLine + 1}-${chunk.endLine + 1})`);
          if (chunk.signature) {
            console.log(`      Signature: ${chunk.signature}`);
          }
        });
      } catch (error) {
        console.log(`    Error parsing: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.log(`    Language not supported`);
    }
    console.log('');
  }
  
  // Test incremental parsing
  console.log('🔄 Testing incremental parsing...\n');
  
  const modifiedContent = testFiles['test.ts'] + '\n// Added comment\nfunction newFunction() { return 42; }';
  writeFileSync(join(testDir, 'test.ts'), modifiedContent);
  
  try {
    const chunks = await parser.parseFile(join(testDir, 'test.ts'), modifiedContent);
    console.log(`   After modification: ${chunks.length} chunks found`);
    const newFunction = chunks.find((c: any) => c.name === 'newFunction');
    if (newFunction) {
      console.log(`    New function detected: ${newFunction.name}`);
    }
  } catch (error) {
    console.log(`    Error in incremental parsing: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Cleanup
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {}
  
  console.log('\n Parser test completed!');
}

// Run the test
testParser().catch(console.error);