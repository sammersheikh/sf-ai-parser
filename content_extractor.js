/**
 * Content script for Address Parser Chrome Extension
 * 
 * This script extracts shipping information from sales order pages
 * and communicates it back to the extension.
 */

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractPageData") {
    console.log("[Address Parser] Extracting page data...");
    
    const result = extractOrderData();
    sendResponse(result);
  }
  return true; // Keep the message channel open for async response
});

/**
 * Extract order data from the page using a simplified approach
 * that matches the original bookmarklet more closely
 */
function extractOrderData() {
  console.log("[Address Parser] Starting extraction");
  
  try {
    // Get the page text content
    let pageText = document.body.innerText.trim();
    
    // Find start and end markers for the section we care about
    let startIndex = pageText.indexOf("Sales Order Name");
    let endIndex = pageText.indexOf("Last Modified By");
    
    if (startIndex === -1 || endIndex === -1) {
      console.log("[Address Parser] Could not find markers");
      return { 
        success: false, 
        error: "Could not find required fields on page" 
      };
    }
    
    // Extract the relevant section
    let extractedText = pageText.substring(startIndex, endIndex + 20);
    let lines = extractedText.split("\n").map(line => line.trim()).filter(line => line);
    
    console.log("[Address Parser] Found", lines.length, "lines");
    
    // Prepare the extracted data object
    let extractedData = {};
    
    // Find specific fields (account, contact)
    for (let i = 0; i < lines.length; i++) {
      let currLine = lines[i];
      
      if (currLine === "Account" && i + 1 < lines.length) {
        extractedData["Account"] = lines[i + 1];
      } else if (currLine === "Contact" && i + 1 < lines.length) {
        extractedData["Contact"] = lines[i + 1];
      }
    }
    
    // Look specifically for shipping address section
    let shippingIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === "Shipping Address") {
        shippingIndex = i;
        break;
      }
    }
    
    // If shipping address found, extract the next few lines as the address
    if (shippingIndex !== -1 && shippingIndex + 1 < lines.length) {
      // Maximum of 5 lines for address or until "Edit" is found
      let addressLines = [];
      let maxAddressLines = 5;
      let j = shippingIndex + 1;
      
      while (j < lines.length && 
             addressLines.length < maxAddressLines && 
             j < shippingIndex + 10) {  // Safety limit
        
        let line = lines[j].trim();
        
        // Stop if we hit "Edit" keyword or other field labels
        if (line.startsWith("Edit") || 
            line === "Billing Frequency" || 
            line === "Expected Delivery Date" ||
            line === "System Quantities" ||
            line === "Service Type") {
          break;
        }
        
        // Add the line to our address
        addressLines.push(line);
        j++;
      }
      
      // Join the address lines with newlines
      if (addressLines.length > 0) {
        extractedData["Raw Shipping Address"] = addressLines.join('\n');
      }
    }
    
    console.log("[Address Parser] Extracted data:", extractedData);
    
    // Check if we got a shipping address
    if (!extractedData["Raw Shipping Address"]) {
      return {
        success: false,
        error: "No shipping address found"
      };
    }
    
    return {
      success: true,
      data: extractedData
    };
    
  } catch (error) {
    console.error("[Address Parser] Extraction error:", error);
    return {
      success: false,
      error: error.message || "Unknown error during extraction"
    };
  }
} 