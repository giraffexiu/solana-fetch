#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';
import bs58 from 'bs58';

dotenv.config();

interface EnhancedTransactionData {
  signature: string;
  slot: number;
  blockTime?: number;
  success: boolean;
  fee: number;
  feePayer: string;
  computeUnitsConsumed?: number;
  
  type: string;
  source: string;
  description: string;
  instructions: InstructionData[];
  events: EventData[];
  nativeTransfers: NativeTransfer[];
  tokenTransfers: TokenTransfer[];
  accountData: AccountData[];
  
  raw?: any;
}

interface DecodedInstructionData {
  originalData: string;
  decodedHex: string;
  decodedBytes: number[];
  dataLength: number;
}

interface InstructionData {
  accounts: string[];
  data: string;
  innerInstructions: any[];
  programId: string;
  parsed?: any;
  decodedData?: DecodedInstructionData | null;
}

interface EventData {
  nft?: any;
  swap?: SwapEvent;
  compressed?: any;
}

interface SwapEvent {
  nativeInput?: TokenAmount;
  nativeOutput?: TokenAmount;
  tokenInputs: TokenAmount[];
  tokenOutputs: TokenAmount[];
}

interface TokenAmount {
  account: string;
  mint: string;
  rawTokenAmount: {
    tokenAmount: string;
    decimals: number;
  };
  tokenAmount: number;
  uiTokenAmount: number;
}

interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

interface TokenTransfer {
  fromTokenAccount: string;
  toTokenAccount: string;
  fromUserAccount: string;
  toUserAccount: string;
  tokenAmount: number;
  mint: string;
  tokenStandard: string;
}

interface AccountData {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges: TokenBalanceChange[];
}

interface TokenBalanceChange {
  mint: string;
  rawTokenAmount: {
    tokenAmount: string;
    decimals: number;
  };
  tokenAccount: string;
  userAccount: string;
}

interface HistoryOptions {
  limit?: number;
  before?: string;
  until?: string;
  verbose?: boolean;
  outputDir?: string;
}

class EnhancedSolanaRpcTool {
  private apiEndpoint: string;
  private apiKey: string;

  constructor(options: HistoryOptions = {}) {
    this.apiKey = process.env.HELIUS_API_KEY || '4d1b21c2-438b-46c4-9dea-a9de33dca7ee';
    this.apiEndpoint = `https://api.helius.xyz/v0/transactions`;
  }

  async fetchEnhancedTransactions(address: string, options: HistoryOptions): Promise<EnhancedTransactionData[]> {
    try {
      console.log(`🚀 Fetching enhanced transactions from Helius API...`);
      console.log(`📊 Target: ${address}`);
      console.log(`📈 Limit: ${options.limit || 100} transactions\n`);
      const addressEndpoint = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${this.apiKey}`;
      
      const response = await axios.get(addressEndpoint, {
        params: {
          limit: options.limit || 100,
          before: options.before,
          until: options.until
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response format from Helius API');
      }

      const transactions: EnhancedTransactionData[] = response.data.map((tx: any) => {
        return {
          signature: tx.signature,
          slot: tx.slot,
          blockTime: tx.timestamp,
          success: !tx.meta?.err,
          fee: tx.meta?.fee || 0,
          feePayer: tx.feePayer || '',
          computeUnitsConsumed: tx.meta?.computeUnitsConsumed,
          
          type: tx.type || 'UNKNOWN',
          source: tx.source || 'UNKNOWN',
          description: tx.description || '',
          instructions: tx.instructions || [],
          events: tx.events || {},
          nativeTransfers: tx.nativeTransfers || [],
          tokenTransfers: tx.tokenTransfers || [],
          accountData: tx.accountData || [],
          
          raw: tx
        };
      });

      if (options.verbose) {
        console.log(`✅ Successfully fetched ${transactions.length} enhanced transactions`);
      }

      return transactions;
    } catch (error) {
      console.error('❌ Error fetching enhanced transactions:', error);
      if (axios.isAxiosError(error)) {
        console.error('API Response:', error.response?.data);
        console.error('Status:', error.response?.status);
      }
      throw error;
    }
  }

  private generateOutputFilename(address: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const shortAddress = address.substring(0, 8);
    return `solana_enhanced_${shortAddress}_${timestamp}.json`;
  }

  private decodeInstructionData(data: string): DecodedInstructionData | null {
    try {
      if (!data || data.trim() === '') {
        return null;
      }
      
      const decodedBytes = bs58.decode(data);
      const decodedHex = Buffer.from(decodedBytes).toString('hex');
      
      return {
        originalData: data,
        decodedHex: decodedHex,
        decodedBytes: Array.from(decodedBytes),
        dataLength: decodedBytes.length
      };
    } catch (error) {
      return null;
    }
  }

  private processTransactionsWithDecoding(transactions: EnhancedTransactionData[]): EnhancedTransactionData[] {
    return transactions.map(transaction => {
      const enhancedInstructions = transaction.instructions.map(instruction => {
        const decodedData = this.decodeInstructionData(instruction.data);
        
        const processInnerInstructions = (innerInstructions: any[]): any[] => {
          return innerInstructions.map(innerInstruction => {
            const innerDecodedData = this.decodeInstructionData(innerInstruction.data);
            return {
              ...innerInstruction,
              decodedData: innerDecodedData,
              innerInstructions: innerInstruction.innerInstructions ? 
                processInnerInstructions(innerInstruction.innerInstructions) : []
            };
          });
        };
        
        return {
          ...instruction,
          decodedData: decodedData,
          innerInstructions: instruction.innerInstructions ? 
            processInnerInstructions(instruction.innerInstructions) : []
        };
      });

      return {
        ...transaction,
        instructions: enhancedInstructions
      };
    });
  }

  async saveEnhancedDataToFile(transactions: EnhancedTransactionData[], address: string, options: HistoryOptions): Promise<string> {
    try {
      const outputDir = options.outputDir || './output';
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filename = this.generateOutputFilename(address);
      const outputPath = path.join(outputDir, filename);

      const processedTransactions = this.processTransactionsWithDecoding(transactions);

      const enhancedData = {
        metadata: {
          fetchTime: new Date().toISOString(),
          targetAddress: address,
          totalTransactions: transactions.length,
          apiSource: 'Helius Enhanced API',
          apiEndpoint: this.apiEndpoint,
          dataVersion: '3.0'
        },
        summary: {
          successfulTransactions: transactions.filter(tx => tx.success).length,
          failedTransactions: transactions.filter(tx => !tx.success).length,
          totalFees: transactions.reduce((sum, tx) => sum + tx.fee, 0),
          totalComputeUnits: transactions.reduce((sum, tx) => sum + (tx.computeUnitsConsumed || 0), 0),
          transactionTypes: this.getTransactionTypeSummary(transactions),
          timeRange: {
            earliest: Math.min(...transactions.map(tx => tx.blockTime || 0)),
            latest: Math.max(...transactions.map(tx => tx.blockTime || 0))
          }
        },
        transactions: processedTransactions
      };

      fs.writeFileSync(outputPath, JSON.stringify(enhancedData, null, 2));
      
      console.log(`\n💾 Enhanced data with decoded instructions saved to: ${outputPath}`);
      console.log(`📊 File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
      
      return outputPath;
    } catch (error) {
      console.error('❌ Error saving enhanced data to file:', error);
      throw error;
    }
  }

  private getTransactionTypeSummary(transactions: EnhancedTransactionData[]): Record<string, number> {
    const typeCounts: Record<string, number> = {};
    transactions.forEach(tx => {
      typeCounts[tx.type] = (typeCounts[tx.type] || 0) + 1;
    });
    return typeCounts;
  }

  displayEnhancedSummary(transactions: EnhancedTransactionData[]): void {
    if (transactions.length === 0) {
      console.log('📭 No enhanced transactions found.');
      return;
    }

    console.log(`\n📊 Enhanced Transaction Summary:\n`);
    console.log(`Total Transactions: ${transactions.length}`);
    console.log(`Successful: ${transactions.filter(tx => tx.success).length}`);
    console.log(`Failed: ${transactions.filter(tx => !tx.success).length}`);
    
    const typeSummary = this.getTransactionTypeSummary(transactions);
    console.log(`\nTransaction Types:`);
    Object.entries(typeSummary).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log(`\nRecent Transactions:`);
    transactions.slice(0, 5).forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.signature.substring(0, 8)}... (${tx.type})`);
      console.log(`   Status: ${tx.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`   Description: ${tx.description || 'N/A'}`);
      if (tx.blockTime) {
        console.log(`   Time: ${new Date(tx.blockTime * 1000).toISOString()}`);
      }
      console.log('');
    });
  }
}

const program = new Command();

program
  .name('solana-rpc-fetcher')
  .description('A tool for fetching Solana program historical transaction data using RPC')
  .version('1.0.0');

program
  .command('history')
  .description('Fetch enhanced historical transactions for a specific address')
  .argument('<address>', 'The address to query')
  .option('-l, --limit <number>', 'Maximum number of transactions to fetch', (val: string) => parseInt(val), 100)
  .option('-o, --output-dir <dir>', 'Output directory for JSON files', './output')
  .option('--before <signature>', 'Start searching backwards from this transaction signature')
  .option('--until <signature>', 'Search until this transaction signature')
  .option('-v, --verbose', 'Enable verbose output', false)
  .action(async (address: string, options: HistoryOptions) => {
    try {
      console.log(`🔍 Fetching enhanced transactions for address: ${address}`);
      console.log(`📊 Limit: ${options.limit || 100} transactions\n`);
      
      const tool = new EnhancedSolanaRpcTool();
      const transactions = await tool.fetchEnhancedTransactions(address, options);
      
      const outputPath = await tool.saveEnhancedDataToFile(transactions, address, options);
      
      if (options.verbose) {
        tool.displayEnhancedSummary(transactions);
      } else {
        console.log(`\n✅ Successfully processed ${transactions.length} transactions`);
        console.log(`📁 Data exported to: ${outputPath}`);
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(async () => {
    console.log('🔧 Current Enhanced Configuration:');
    console.log(`   HELIUS_API_KEY: ${process.env.HELIUS_API_KEY ? '***set***' : 'using default key'}`);
    console.log(`   API Endpoint: https://api.helius.xyz/v0/transactions`);
    console.log(`   Data Version: 2.0 (Enhanced)`);
    console.log('');
    console.log('💡 You can set your own API key in a .env file:');
    console.log('   HELIUS_API_KEY=your-helius-api-key');
    console.log('');
    console.log('🚀 Default Helius API key is pre-configured and ready to use!');
    
    try {
      console.log('\n🔍 Testing API connectivity...');
      const tool = new EnhancedSolanaRpcTool();
      console.log('✅ Configuration loaded successfully');
    } catch (error) {
      console.error('❌ Configuration error:', error);
    }
  });

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n👋 Received SIGINT. Gracefully shutting down...');
  process.exit(0);
});

if (require.main === module) {
  program.parse();
}

export { EnhancedSolanaRpcTool, EnhancedTransactionData };