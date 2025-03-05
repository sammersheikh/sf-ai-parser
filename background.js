// Address parser for Chrome extension
// Uses local LLM Studio API for address parsing

/**
 * Parse address using LM Studio's local LLM
 * @param {string} address - Raw address string
 * @returns {Promise<object>} Parsed address components
 */
async function parseAddressWithLLM(address) {
  // Default return object if parsing fails
  const defaultResult = {
    'Address 1': '',
    'Address 2': '',
    'City': '',
    'State': '',
    'ZIP': '',
    'Country': 'USA'
  };

  try {
    console.log('Sending address to local LLM:', address);

    // Prepare the API call to the local LLM
    const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio' // This can be any string as per the docs
      },
      body: JSON.stringify({
        model: 'local-model', // This can be any string as per the docs
        messages: [
          {
            role: 'system',
            content: `You are an address parsing assistant specialized in extracting address components accurately.

Extract the components of an address into a JSON structure with these exact fields: "Address 1", "Address 2", "City", "State", "ZIP", and "Country".

Important guidelines:
1. "Address 1" should contain the street number and name (e.g., "123 Main St")
2. "Address 2" should contain apartment numbers, suite numbers, unit numbers, floor designations, building names, etc. (e.g., "Apt 101", "Suite B", "Unit 5", "Floor 3", "#42")
3. If a component is not present, leave its value as an empty string.
4. If you're uncertain about a component, make your best guess based on common address patterns.
5. For US addresses, assume USA as the default country if none is specified.
6. The output should be valid JSON format with no additional commentary.`
          },
          {
            role: 'user',
            content: `Parse this address: "${address}"`
          }
        ],
        temperature: 0.1, // Lower temperature for more deterministic output
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('LLM response:', data);

    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response from LLM');
    }

    // Extract the parsed address from the LLM's response
    const content = data.choices[0].message.content;
    
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from LLM response');
    }

    // Parse the JSON
    const parsedAddress = JSON.parse(jsonMatch[0]);
    console.log('Parsed address:', parsedAddress);

    // Ensure all required fields exist
    const result = {
      'Address 1': parsedAddress['Address 1'] || '',
      'Address 2': parsedAddress['Address 2'] || '',
      'City': parsedAddress['City'] || '',
      'State': parsedAddress['State'] || '',
      'ZIP': parsedAddress['ZIP'] || '',
      'Country': parsedAddress['Country'] || 'USA'
    };

    return result;
  } catch (error) {
    console.error('Error calling local LLM:', error);
    
    // Fallback to regex parsing if LLM fails
    console.log('Falling back to regex parsing');
    return parseAddressWithRegex(address);
  }
}

/**
 * Parse address using regex patterns (fallback method)
 * @param {string} address - Raw address string
 * @returns {object} Parsed address components
 */
function parseAddressWithRegex(address) {
  // Default return object
  const result = {
    'Address 1': '',
    'Address 2': '',
    'City': '',
    'State': '',
    'ZIP': '',
    'Country': 'USA' // Default to USA
  };

  try {
    // Clean the address string
    address = address.trim()
      .replace(/\r\n/g, '\n')
      .replace(/\n+/g, ', ')
      .replace(/\s+/g, ' ')
      .replace(/,,/g, ',');

    console.log('Cleaned address for regex parsing:', address);

    // Extract ZIP code (US format)
    const zipMatch = address.match(/\b(\d{5}(-\d{4})?)\b/);
    if (zipMatch) {
      result.ZIP = zipMatch[1];
      // Remove the ZIP from the address to simplify further parsing
      address = address.replace(zipMatch[1], '');
    }

    // Extract state (2-letter US state code)
    const stateMatch = address.match(/,?\s*([A-Z]{2})\s*,?/);
    if (stateMatch) {
      result.State = stateMatch[1];
      // Remove the state from the address
      address = address.replace(stateMatch[0], ',');
    }

    // Clean up commas
    address = address.replace(/,\s*,/g, ',').replace(/,\s*$/g, '');

    // Extract city (assume it's the last part before state/zip)
    const parts = address.split(',');
    if (parts.length > 1) {
      result.City = parts[parts.length - 1].trim();
      
      // Remaining parts are Address1 and potentially Address2
      const streetParts = parts.slice(0, parts.length - 1).join(',').trim();
      
      // Enhanced address 2 detection
      // Common patterns for apartment/suite identifiers
      const addr2Patterns = [
        // Match patterns like "Apt 101", "Suite B", "Unit 5", "Building C", etc.
        /\b(apt\.?|apartment|suite|ste\.?|unit|bldg\.?|building|floor|fl\.?|room|rm\.?)\s+[a-z0-9-]+\b/i,
        // Match patterns like "#101", "#B", etc.
        /\s+#\s*[a-z0-9-]+\b/i,
        // Match patterns with abbreviations or specific formats
        /\b(unit|apt\.?|suite|ste\.?)\s*#?\s*[a-z0-9-]+\b/i
      ];
      
      let addr2Match = null;
      let matchIndex = -1;
      
      // Try to find Address 2 information
      for (const pattern of addr2Patterns) {
        const match = streetParts.match(pattern);
        if (match && match.index > 0) {
          if (matchIndex === -1 || match.index < matchIndex) {
            addr2Match = match;
            matchIndex = match.index;
          }
        }
      }
      
      // Also check for comma-separated apartment info like "123 Main St, Apt 101"
      const commaSeparatedMatch = streetParts.match(/,\s*(.*)/);
      
      if (addr2Match && matchIndex > 0) {
        // Found in-line address 2 info
        result['Address 1'] = streetParts.substring(0, matchIndex).trim();
        result['Address 2'] = streetParts.substring(matchIndex).trim();
      } else if (commaSeparatedMatch && commaSeparatedMatch[1]) {
        // Found comma-separated address 2 info
        const potentialAddr2 = commaSeparatedMatch[1].trim();
        
        // Check if this looks like an Address 2 component
        const looksLikeAddr2 = /^(apt|suite|ste|unit|bldg|#|apartment|building|floor)/i.test(potentialAddr2);
        
        if (looksLikeAddr2) {
          result['Address 1'] = streetParts.substring(0, commaSeparatedMatch.index).trim();
          result['Address 2'] = potentialAddr2;
        } else {
          // If it doesn't look like Address 2, keep it all as Address 1
          result['Address 1'] = streetParts;
        }
      } else {
        // No Address 2 found
        result['Address 1'] = streetParts;
      }
    } else {
      // If no commas, assume it's all Address 1
      result['Address 1'] = address.trim();
    }

    // Additional processing for better results
    // If no City was detected but we have State, try to find the city
    if (!result.City && result.State) {
      // Look for patterns like "San Francisco CA" or "New York NY"
      const cityBeforeStatePattern = new RegExp(`([\\w\\s]+)\\s+${result.State}`, 'i');
      const cityMatch = address.match(cityBeforeStatePattern);
      if (cityMatch && cityMatch[1]) {
        // Extract the last word or phrase before the state code
        const potentialCity = cityMatch[1].trim().split(/\s+/);
        // Get the last 1-3 words as the potential city name
        const cityName = potentialCity.slice(Math.max(0, potentialCity.length - 3)).join(' ');
        if (cityName) {
          result.City = cityName;
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error in regex parsing:', error);
    return result;
  }
}

// Check if the local LLM is available
async function checkLocalLLM() {
  try {
    const response = await fetch('http://127.0.0.1:1234/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer lm-studio'
      }
    });
    
    if (response.ok) {
      console.log('Local LLM is available');
      return true;
    } else {
      console.warn('Local LLM returned an error response:', response.status);
      return false;
    }
  } catch (error) {
    console.warn('Could not connect to local LLM:', error);
    return false;
  }
}

// Process messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.type === 'parseAddress') {
    console.log('Processing address:', request.address);
    
    // Parse the address and send back the result
    parseAddressWithLLM(request.address)
      .then(result => {
        console.log('Parsing result:', result);
        sendResponse({ 
          success: true, 
          data: result,
          usedLLM: true
        });
      })
      .catch(error => {
        console.error('LLM parsing error, using regex fallback:', error);
        
        // Fallback to regex parsing
        const fallbackResult = parseAddressWithRegex(request.address);
        sendResponse({ 
          success: true, 
          data: fallbackResult,
          usedLLM: false
        });
      });
    
    return true; // Will respond asynchronously
  } else if (request.type === 'checkLLMStatus') {
    // Check if the local LLM is available
    checkLocalLLM()
      .then(available => {
        sendResponse({ available });
      })
      .catch(error => {
        console.error('Error checking LLM status:', error);
        sendResponse({ available: false });
      });
    
    return true; // Will respond asynchronously
  }
});