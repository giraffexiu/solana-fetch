# Solana RPC Transaction Fetcher

A TypeScript tool for fetching Solana transaction history using Helius RPC API.

## Features

- Query historical transactions for Solana addresses
- Enhanced transaction data with Helius API
- Export results to JSON format
- Command-line interface
- Built-in instruction data decoding

## Installation

```bash
npm install
npm run build
```

## Configuration

Copy the environment template and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` file:
```env
RPC_ENDPOINT=your_helius_endpoint_here
API_KEY=your_api_key_here
```

## Usage

### Basic Usage

```bash
npm start history <address>
```

### Options

```bash
# Limit number of transactions
npm start history <address> --limit 50

# Save to specific directory
npm start history <address> --output-dir ./results

# Enable verbose output
npm start history <address> --verbose

# Query with transaction boundaries
npm start history <address> --before <signature>
npm start history <address> --until <signature>
```

### Command Options

| Option | Description | Default |
|--------|-------------|----------|
| `-l, --limit <number>` | Maximum transactions to fetch | 100 |
| `-o, --output-dir <dir>` | Output directory for JSON files | ./output |
| `--before <signature>` | Start from this transaction | - |
| `--until <signature>` | Stop at this transaction | - |
| `-v, --verbose` | Enable verbose output | false |

### View Configuration

```bash
npm start config
```

## Examples

```bash
# Query Jupiter aggregator transactions
npm start history JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN --limit 10

# Query wallet address transactions
npm start history vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg --verbose
```

## Common Program IDs

| Program | ID |
|---------|----|
| Jupiter V6 | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` |
| SPL Token | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
| System Program | `11111111111111111111111111111111` |

## Output Format

Transaction data is automatically saved to JSON files in the output directory. The tool provides enhanced transaction information including:

- Transaction signatures and metadata
- Instruction data with decoding
- Token transfers and native transfers
- Account balance changes
- Event data (swaps, NFT operations, etc.)

## Troubleshooting

- Check network connection and API key configuration
- Verify address format is correct
- Use `--verbose` flag for detailed output
- Reduce `--limit` for faster queries

## Development

```bash
# Development mode
npm run dev

# Build
npm run build

# Clean build files
npm run clean
```

## License

MIT