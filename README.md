# Address Parser Chrome Extension

This extension parses address data from Salesforce sales order pages or clipboard JSON and formats it with structured fields using a local LLM powered by LM Studio.

## Features

- Directly extracts shipping addresses from Salesforce pages
- Reads JSON address data from clipboard
- Uses a local LLM (Language Model) hosted by LM Studio for intelligent address parsing
- Falls back to regex pattern matching if the LLM is unavailable
- Parses the address into structured components
- Returns the formatted address with the following fields:
  - Address 1
  - Address 2
  - City
  - State
  - ZIP
  - Country
- Works entirely within your browser and local machine (no external servers)

## Setup Requirements

1. **Install LM Studio**: Download and install [LM Studio](https://lmstudio.ai/) on your computer
2. **Start a Local Server**:
   - Open LM Studio
   - Load a language model of your choice
   - Start the local server (usually at http://127.0.0.1:1234)

## How to Use

### Method 1: Extract Directly from Salesforce

1. **Make sure your local LLM is running** in LM Studio at http://127.0.0.1:1234

2. **Navigate to a Salesforce sales order page** containing shipping information

3. **Click the extension icon** in your Chrome toolbar to open the popup

4. **Click "Extract Address from Current Page"** button
   - The extension will find and extract the shipping address from the page
   - It will then parse the address using your local LLM
   - The structured result will be copied to your clipboard

5. **Paste the structured data** wherever you need it

### Method 2: Parse from Clipboard JSON

1. **Make sure your local LLM is running** in LM Studio at http://127.0.0.1:1234

2. **Copy address data to clipboard** in JSON format with a "Raw Shipping Address" field, for example:
   ```json
   {
     "Raw Shipping Address": "123 Main St, Suite 100, San Francisco, CA 94105",
     "Contact": "John Smith"
   }
   ```

3. **Click the extension icon** in your Chrome toolbar to open the popup

4. **Click "Parse Address from Clipboard"** button

5. The extension will **parse the address using your local LLM** and **write the structured data back to your clipboard** in JSON format:
   ```json
   {
     "Raw Shipping Address": "123 Main St, Suite 100, San Francisco, CA 94105",
     "Contact": "John Smith",
     "Address 1": "123 Main St",
     "Address 2": "Suite 100",
     "City": "San Francisco",
     "State": "CA",
     "ZIP": "94105",
     "Country": "USA"
   }
   ```

6. You can now **paste the structured address** wherever you need it

## Salesforce Compatibility

The extension is specifically designed to work with Salesforce sales order pages:

- It automatically finds the "Shipping Address" field in the page
- It handles multi-line addresses (including Attn: lines, street addresses, and city/state/zip)
- It correctly extracts addresses even when they span multiple lines or have inconsistent formatting
- Works with standard Salesforce layout or custom implementations

## Installation

### From Chrome Web Store
* Coming soon

### Manual Installation
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked" and select the folder containing this extension
5. The extension should now appear in your extensions list and toolbar

## Permissions

This extension requires the following permissions:
- **Clipboard Read**: To read address data from your clipboard
- **Clipboard Write**: To write parsed data back to your clipboard
- **Storage**: To save extension preferences
- **ActiveTab**: To access the current tab for extracting address data
- **Host Permissions** for `http://127.0.0.1:1234/*`: To connect to your local LLM

## Fallback Mode

If the extension cannot connect to the local LLM, it will automatically fall back to using regex pattern matching for address parsing. This ensures the extension continues to work even when the LLM is not available.

## Privacy

This extension operates entirely on your local machine, using your own LLM. Your data never leaves your computer and is not sent to any external servers. 