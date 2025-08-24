export default defineBackground(() => {
  console.log('Gmail scraper background script loaded', { id: browser.runtime.id });
  
  // Store the latest Gmail data
  let latestGmailData: any = null;

  // Listen for messages from content script and popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);

    if (message.type === 'GMAIL_DATA') {
      // Store the data from content script
      latestGmailData = message.data;
      console.log('Stored Gmail data:', latestGmailData);
      sendResponse({ success: true });
    } else if (message.type === 'GET_GMAIL_DATA') {
      // Popup is requesting Gmail data
      console.log('Popup requested Gmail data');
      
      // Try to get data from active tab's content script
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.id && tabs[0].url?.includes('mail.google.com')) {
          // Send message to content script to get fresh data
          browser.tabs.sendMessage(tabs[0].id, { type: 'GET_GMAIL_DATA' })
            .then((response) => {
              console.log('Got fresh data from content script:', response);
              sendResponse(response);
            })
            .catch((error) => {
              console.log('Could not get fresh data, returning stored data:', error);
              sendResponse(latestGmailData);
            });
        } else {
          console.log('Not on Gmail, returning stored data');
          sendResponse(latestGmailData);
        }
      });
      
      return true; // Indicates we will send a response asynchronously
    } else if (message.type === 'CAPTURE_SCREENSHOT') {
      // Legacy screenshot support - no longer used for website scanning
      // DOM parsing is now handled directly in content script
      console.log('Screenshot capture requested (legacy)');
      sendResponse({ screenshot: null, error: 'Screenshot capture deprecated - using DOM parsing instead' });
    }
  });

  console.log('Background script initialized');
});
