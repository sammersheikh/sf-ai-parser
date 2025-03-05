/**
 * Address Parser Extension
 * 
 * This script handles reading address data from clipboard,
 * sending it for parsing with a local LLM, and writing the structured result back to clipboard.
 */
document.addEventListener('DOMContentLoaded', function() {
    const statusDiv = document.getElementById('status');
    const parseBtn = document.getElementById('parseClipboardBtn');
    const extractBtn = document.getElementById('extractPageBtn');
    let llmAvailable = false;
    
    // Check if the local LLM is available
    checkLLMStatus();
    
    // Function to check LLM status
    function checkLLMStatus() {
      statusDiv.textContent = 'Checking local LLM status...';
      statusDiv.style.color = 'blue';
      
      chrome.runtime.sendMessage({ type: 'checkLLMStatus' }, response => {
        llmAvailable = response && response.available;
        if (llmAvailable) {
          statusDiv.textContent = 'Ready to parse with local LLM';
          statusDiv.style.color = 'green';
        } else {
          statusDiv.textContent = 'Local LLM not available. Will use fallback parsing method.';
          statusDiv.style.color = 'orange';
        }
      });
    }
    
    /**
     * Writes text to clipboard, with fallback methods if direct API fails
     * @param {string} text - Text to write to clipboard
     * @returns {Promise<boolean>} Success status
     */
    async function writeToClipboard(text) {
      try {
        // Try the modern Clipboard API first
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.log('Direct clipboard write failed, trying fallback method:', err);
        
        // Create a temporary textarea element
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Make it non-editable to avoid focus and style it to be invisible
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        
        document.body.appendChild(textArea);
        
        // Focus and select the text
        textArea.focus();
        textArea.select();
        
        let success = false;
        try {
          // Execute copy command
          success = document.execCommand('copy');
          if (success) {
            console.log('Fallback clipboard copy succeeded');
          } else {
            console.error('Fallback clipboard copy failed');
          }
        } catch (err) {
          console.error('Fallback clipboard copy error:', err);
        }
        
        // Clean up
        document.body.removeChild(textArea);
        return success;
      }
    }
    
    /**
     * Processes address data through local LLM and updates result
     * @param {Object} addressData - The address data to process
     */
    async function processAddressData(addressData) {
      statusDiv.textContent = 'Processing...';
      statusDiv.style.color = 'blue';
      
      try {
        if (!addressData["Raw Shipping Address"]) {
          throw new Error('No "Raw Shipping Address" field found in data');
        }

        // Clean the address string
        let address = addressData["Raw Shipping Address"]
          .replace(/\battention\s*-\s*\b/i, '')
          .trim();
        
        // If contact info is present, remove it from the address
        if (addressData["Contact"]) {
          address = address.replace(new RegExp(addressData["Contact"], 'i'), '').trim();
        }
        
        console.log('Cleaned address:', address);
        
        // Update status while processing
        statusDiv.textContent = llmAvailable 
          ? 'Processing with local LLM...' 
          : 'Processing address...';

        // Send to background script for parsing
        const response = await chrome.runtime.sendMessage({
          type: 'parseAddress',
          address: address
        });
        
        console.log('Background response:', response);

        if (!response || !response.success) {
          throw new Error(response?.error || 'Failed to parse address');
        }

        // Add the parsed address back to the original JSON
        const result = {
          ...addressData,
          ...response.data
        };

        // Convert to formatted JSON string
        const formattedResult = JSON.stringify(result, null, 2);
        console.log('Formatted result ready');
        
        // Write back to clipboard using our enhanced method
        const clipboardWriteSuccess = await writeToClipboard(formattedResult);
        
        if (clipboardWriteSuccess) {
          if (response.usedLLM) {
            statusDiv.textContent = '✓ Address parsed with local LLM and copied to clipboard!';
            statusDiv.style.color = 'green';
          } else {
            statusDiv.textContent = '✓ Address parsed with fallback method and copied to clipboard';
            statusDiv.style.color = 'orange';
          }
        } else {
          // If both clipboard methods failed, show the text for manual copying
          statusDiv.innerHTML = 'Could not automatically copy to clipboard. Please copy this text manually:<br>';
          
          // Create a pre element with the formatted text
          const pre = document.createElement('pre');
          pre.style.marginTop = '10px';
          pre.style.padding = '8px';
          pre.style.background = '#f5f5f5';
          pre.style.borderRadius = '4px';
          pre.style.overflow = 'auto';
          pre.style.maxHeight = '150px';
          pre.style.fontSize = '11px';
          pre.textContent = formattedResult;
          
          statusDiv.appendChild(pre);
          statusDiv.style.color = 'red';
        }
      } catch (error) {
        console.error('Error in processing:', error);
        statusDiv.textContent = error.message || 'An error occurred';
        statusDiv.style.color = 'red';
      }
    }
    
    // Set up the extract from page button
    extractBtn.addEventListener('click', async () => {
      console.log('Extract from page button clicked');
      statusDiv.textContent = 'Extracting data from page...';
      statusDiv.style.color = 'blue';
      
      try {
        // Query for active tab
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tabs || !tabs[0] || !tabs[0].id) {
          throw new Error('Cannot access current tab');
        }
        
        const tabId = tabs[0].id;
        
        // Send message to content script to extract data
        const result = await chrome.tabs.sendMessage(tabId, {action: "extractPageData"});
        console.log('Extraction result:', result);
        
        if (!result || !result.success) {
          throw new Error(result?.error || 'Failed to extract data from page');
        }
        
        // Process the extracted data
        await processAddressData(result.data);
        
      } catch (error) {
        console.error('Error extracting from page:', error);
        
        // Check if this is a connection error, which usually means content script isn't loaded
        if (error.message.includes('Could not establish connection') || 
            error.message.includes('connect') || 
            error.message.includes('Receiving end does not exist')) {
          statusDiv.textContent = 'Please refresh the page and try again';
        } else {
          statusDiv.textContent = error.message || 'An error occurred';
        }
        statusDiv.style.color = 'red';
      }
    });
    
    // Set up the parse from clipboard button
    parseBtn.addEventListener('click', async () => {
      console.log('Parse button clicked');
      statusDiv.textContent = 'Processing...';
      statusDiv.style.color = 'blue';
      
      try {
        // Check clipboard permission status
        const permissionStatus = await navigator.permissions.query({
          name: 'clipboard-read'
        }).catch(error => {
          // Fall back to trying direct read if permissions API is unavailable
          console.log('Permission check not supported, trying direct read');
          return { state: 'prompt' };
        });
        
        console.log('Clipboard permission:', permissionStatus.state);
        
        // Read from clipboard
        let text;
        try {
          text = await navigator.clipboard.readText();
          console.log('Clipboard text retrieved');
        } catch (error) {
          throw new Error('Cannot read clipboard: Please grant clipboard permission in site settings');
        }
        
        if (!text || text.trim() === '') {
          throw new Error('Clipboard is empty');
        }
        
        let addressData;
        try {
          // Try to parse JSON from clipboard
          addressData = JSON.parse(text);
          console.log('Parsed JSON from clipboard');
        } catch (error) {
          throw new Error('Invalid JSON in clipboard. Make sure you have copied valid JSON data.');
        }
        
        // Process the address data
        await processAddressData(addressData);
        
      } catch (error) {
        console.error('Error in popup:', error);
        statusDiv.textContent = error.message || 'An error occurred';
        statusDiv.style.color = 'red';
      }
    });
  });