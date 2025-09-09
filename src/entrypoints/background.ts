import { detectSiteType, isSignificantUrlChange, type SiteDetectionResult } from '@/utils/urlDetection';
import { initializeStorageManager, getAutoDetectionSettings, addAnalysisToHistory } from '@/utils/storageManager';

export default defineBackground(() => {
  console.log('mAIscam background script loaded with auto-detection', { id: browser.runtime.id });
  
  // Store the latest Gmail data
  let latestGmailData: any = null;
  
  // Store the last detected site info for each tab
  let tabSiteInfo: { [tabId: number]: { url: string; detection: SiteDetectionResult; timestamp: number } } = {};
  
  // Store report status for each tab/analysis - key format: `${tabId}-${analysisHash}`
  let reportStatus: { [key: string]: { 
    reportId?: string; 
    timestamp: number; 
    scamType: 'email' | 'website' | 'socialmedia';
    analysisData: any;
  } } = {};
  
  // Store analysis results for each tab - key format: tabId
  let tabAnalysisState: { [tabId: number]: {
    analysisResult: any;
    extractedData: any;
    websiteData: any;
    facebookData: any;
    scamType: 'email' | 'website' | 'socialmedia';
    timestamp: number;
    reportStatus?: { reportId?: string; timestamp?: number };
  } } = {};
  
  // Auto-detection settings (loaded from storage)
  let autoDetectionEnabled = true;
  
  // Initialize storage and load settings
  initializeStorageManager().then(async () => {
    try {
      const settings = await getAutoDetectionSettings();
      autoDetectionEnabled = settings.autoDetectionEnabled;
      console.log('🔧 [AUTO-DETECT] Settings loaded from storage:', settings);
      
      // Initialize detection for all existing tabs
      await initializeExistingTabs();
      
    } catch (error) {
      console.error('❌ [AUTO-DETECT] Failed to load settings:', error);
    }
  });

  // Function to initialize detection for all existing tabs
  async function initializeExistingTabs() {
    try {
      console.log('🔍 [AUTO-DETECT] Initializing detection for existing tabs...');
      
      // Get all tabs in all windows
      const tabs = await browser.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('moz-extension://')) {
          try {
            const detection = detectSiteType(tab.url);
            
            if (detection.confidence > 0) {
              tabSiteInfo[tab.id] = {
                url: tab.url,
                detection,
                timestamp: Date.now()
              };
              
              console.log(`🔍 [AUTO-DETECT] Initialized tab ${tab.id}: ${detection.type}/${detection.platform || 'generic'}`);
              
              // Update badge for active tab
              if (tab.active) {
                await updateExtensionBadge(tab.id, detection);
              }
            }
          } catch (error) {
            console.error(`❌ [AUTO-DETECT] Failed to initialize tab ${tab.id}:`, error);
          }
        }
      }
      
      console.log(`✅ [AUTO-DETECT] Initialized ${Object.keys(tabSiteInfo).length} tabs`);
      
    } catch (error) {
      console.error('❌ [AUTO-DETECT] Failed to initialize existing tabs:', error);
    }
  }

  // Handle action icon click to open side panel
  browser.action.onClicked.addListener(async (tab) => {
    console.log('Extension icon clicked, opening side panel');
    try {
      if (tab.id) {
        await browser.sidePanel.open({ tabId: tab.id });
      }
    } catch (error) {
      console.error('Failed to open side panel:', error);
    }
  });

  // Listen for tab updates to detect site type changes
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only process when URL changes and page is loading or complete
    if (!changeInfo.url || !tab.url || !autoDetectionEnabled) return;
    
    console.log(`🔍 [AUTO-DETECT] Tab ${tabId} URL changed to: ${changeInfo.url}`);
    
    try {
      // Get previous site info for this tab
      const previousInfo = tabSiteInfo[tabId];
      const currentUrl = changeInfo.url;
      
      // Check if this is a significant URL change
      if (previousInfo && !isSignificantUrlChange(previousInfo.url, currentUrl)) {
        console.log(`🔍 [AUTO-DETECT] Tab ${tabId}: URL change not significant, skipping`);
        return;
      }
      
      // Detect site type with error handling
      let detection: SiteDetectionResult;
      try {
        detection = detectSiteType(currentUrl);
        console.log(`🔍 [AUTO-DETECT] Tab ${tabId} detected as:`, detection);
      } catch (detectionError) {
        console.error(`❌ [AUTO-DETECT] Site detection failed for tab ${tabId}:`, detectionError);
        detection = {
          type: 'website',
          confidence: 0
        };
      }
      
      // Store the detection result
      tabSiteInfo[tabId] = {
        url: currentUrl,
        detection,
        timestamp: Date.now()
      };
      
      // Update extension icon badge to show detected type (with error handling)
      try {
        await updateExtensionBadge(tabId, detection);
      } catch (badgeError) {
        console.error(`❌ [AUTO-DETECT] Failed to update badge for tab ${tabId}:`, badgeError);
      }
      
    } catch (error) {
      console.error(`❌ [AUTO-DETECT] Critical error processing tab ${tabId}:`, error);
      
      // Try to clear any corrupted tab info
      try {
        delete tabSiteInfo[tabId];
        await browser.action.setBadgeText({ text: '', tabId });
      } catch (cleanupError) {
        console.error(`❌ [AUTO-DETECT] Failed to cleanup after error:`, cleanupError);
      }
    }
  });

  // Listen for tab activation (switching between tabs)
  browser.tabs.onActivated.addListener(async (activeInfo) => {
    if (!autoDetectionEnabled) return;
    
    const { tabId } = activeInfo;
    console.log(`🔄 [AUTO-DETECT] Tab ${tabId} activated (switched to)`);
    
    try {
      // Get the tab information
      const tab = await browser.tabs.get(tabId);
      if (!tab.url) return;
      
      console.log(`🔄 [AUTO-DETECT] Switched to tab ${tabId}: ${tab.url}`);
      
      // Check if we have detection info for this tab
      let tabInfo = tabSiteInfo[tabId];
      
      if (!tabInfo && tab.url) {
        // First time seeing this tab, detect site type
        console.log(`🔍 [AUTO-DETECT] First detection for tab ${tabId}`);
        
        try {
          const detection = detectSiteType(tab.url);
          console.log(`🔍 [AUTO-DETECT] Tab ${tabId} detected as:`, detection);
          
          tabInfo = {
            url: tab.url,
            detection,
            timestamp: Date.now()
          };
          
          tabSiteInfo[tabId] = tabInfo;
          
          // Update badge for this tab
          await updateExtensionBadge(tabId, detection);
          
        } catch (detectionError) {
          console.error(`❌ [AUTO-DETECT] Detection failed for tab ${tabId}:`, detectionError);
          return;
        }
      } else if (tabInfo) {
        // We have info for this tab, just update the badge
        console.log(`🔄 [AUTO-DETECT] Restoring badge for tab ${tabId}:`, tabInfo.detection.type);
        await updateExtensionBadge(tabId, tabInfo.detection);
      }
      
      // Notify sidebar about tab switch if it's open
      browser.runtime.sendMessage({
        type: 'TAB_SWITCHED',
        tabId: tabId,
        tabInfo: tabInfo,
        timestamp: Date.now()
      }).catch(() => {
        // Sidebar might not be open, which is fine
        console.log(`📱 [AUTO-DETECT] Sidebar not open for tab switch notification`);
      });
      
    } catch (error) {
      console.error(`❌ [AUTO-DETECT] Error handling tab activation for ${tabId}:`, error);
    }
  });

  // Clean up tab info when tabs are closed
  browser.tabs.onRemoved.addListener((tabId) => {
    delete tabSiteInfo[tabId];
    delete tabAnalysisState[tabId];
    
    // Clean up report status for this tab
    Object.keys(reportStatus).forEach(key => {
      if (key.startsWith(`${tabId}-`)) {
        delete reportStatus[key];
      }
    });
    
    console.log(`🗑️ [AUTO-DETECT] Cleaned up info for closed tab ${tabId}`);
  });

  // Function to update extension badge based on detected site type
  async function updateExtensionBadge(tabId: number, detection: SiteDetectionResult) {
    try {
      let badgeText = '';
      let badgeColor = '#6B7280'; // Default gray
      
      switch (detection.type) {
        case 'email':
          badgeText = '📧';
          badgeColor = '#3B82F6'; // Blue
          break;
        case 'social':
          badgeText = '👥';
          badgeColor = '#8B5CF6'; // Purple
          break;
        case 'search':
          badgeText = '🔍';
          badgeColor = '#F59E0B'; // Amber
          break;
        case 'banking':
          badgeText = '🏦';
          badgeColor = '#DC2626'; // Red
          break;
        case 'ecommerce':
          badgeText = '🛒';
          badgeColor = '#059669'; // Emerald
          break;
        case 'website':
          badgeText = '🌐';
          badgeColor = '#10B981'; // Green
          break;
        default:
          badgeText = '❓';
          badgeColor = '#6B7280'; // Gray
          break;
      }
      
      // Add platform-specific customization
      if (detection.platform) {
        switch (detection.platform) {
          case 'gmail':
            badgeText = '✉️';
            break;
          case 'facebook':
            badgeText = '📘';
            break;
          case 'twitter':
            badgeText = '🐦';
            break;
          case 'instagram':
            badgeText = '📷';
            break;
          case 'youtube':
            badgeText = '📺';
            break;
          case 'linkedin':
            badgeText = '💼';
            break;
          case 'tiktok':
            badgeText = '🎵';
            break;
          case 'amazon':
            badgeText = '📦';
            break;
          case 'paypal':
            badgeText = '💳';
            break;
        }
      }
      
      await browser.action.setBadgeText({
        text: badgeText,
        tabId: tabId
      });
      
      await browser.action.setBadgeBackgroundColor({
        color: badgeColor,
        tabId: tabId
      });
      
      console.log(`🎯 [AUTO-DETECT] Badge updated for tab ${tabId}: ${badgeText} (${detection.type}/${detection.platform})`);
      
    } catch (error) {
      console.error('Failed to update extension badge:', error);
    }
  }

  // Helper function to generate analysis hash for consistent identification
  function generateAnalysisHash(analysisData: any, scamType: string): string {
    // Create a simple hash based on the analysis content
    let hashString = `${scamType}-`;
    
    if (scamType === 'email' && analysisData.subject && analysisData.content) {
      hashString += `${analysisData.subject}-${analysisData.content.substring(0, 100)}`;
    } else if (scamType === 'website' && analysisData.url && analysisData.title) {
      hashString += `${analysisData.url}-${analysisData.title}`;
    } else if (scamType === 'socialmedia' && analysisData.caption && analysisData.username) {
      hashString += `${analysisData.username}-${analysisData.caption.substring(0, 100)}`;
    }
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Helper function to get report key
  function getReportKey(tabId: number, analysisHash: string): string {
    return `${tabId}-${analysisHash}`;
  }

  // Listen for messages from content script and popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);

    if (message.type === 'URL_CHANGED_IN_CONTENT') {
      // Handle URL change notification from content script
      const tabId = sender.tab?.id;
      if (tabId && message.newUrl && message.detection) {
        console.log(`🔄 [AUTO-DETECT] Content script reported URL change for tab ${tabId}:`);
        console.log(`🔄 [AUTO-DETECT] From: ${message.oldUrl}`);
        console.log(`🔄 [AUTO-DETECT] To: ${message.newUrl}`);
        console.log(`🔄 [AUTO-DETECT] Domain change: ${message.isDomainChange}`);
        console.log(`🔄 [AUTO-DETECT] Old detection:`, message.oldDetection);
        console.log(`🔄 [AUTO-DETECT] New detection:`, message.detection);
        
        // Special logging for back/forward navigation scenarios
        if (message.oldDetection && message.detection) {
          const navigationScenario = `${message.oldDetection.type}/${message.oldDetection.platform} → ${message.detection.type}/${message.detection.platform}`;
          console.log(`🔄 [AUTO-DETECT] Navigation scenario: ${navigationScenario}`);
          
          // Check if this could be back/forward navigation (URL seen before)
          const previousInfo = Object.values(tabSiteInfo).find(info => info.url === message.newUrl);
          if (previousInfo) {
            console.log(`🔙 [AUTO-DETECT] Possible back/forward navigation - URL seen before: ${message.newUrl}`);
          }
        }
        
        // Update stored tab info
        tabSiteInfo[tabId] = {
          url: message.newUrl,
          detection: message.detection,
          timestamp: message.timestamp || Date.now()
        };
        
        // Update extension badge
        updateExtensionBadge(tabId, message.detection).catch((error) => {
          console.error(`❌ [AUTO-DETECT] Failed to update badge after content script URL change:`, error);
        });
        
        // Notify sidebar about the change if it's open
        browser.runtime.sendMessage({
          type: 'TAB_URL_CHANGED',
          tabId: tabId,
          tabInfo: tabSiteInfo[tabId],
          oldDetection: message.oldDetection,
          newDetection: message.detection,
          isDomainChange: message.isDomainChange,
          timestamp: message.timestamp || Date.now()
        }).catch(() => {
          // Sidebar might not be open, which is fine
          console.log(`📱 [AUTO-DETECT] Sidebar not open for URL change notification`);
        });
        
        console.log(`✅ [AUTO-DETECT] Updated tab ${tabId} info from content script:`, message.detection);
      } else {
        console.warn(`⚠️ [AUTO-DETECT] Incomplete URL change message:`, {
          tabId,
          hasNewUrl: !!message.newUrl,
          hasDetection: !!message.detection,
          message
        });
      }
      sendResponse({ success: true });
    } else if (message.type === 'MANUAL_REDETECTION') {
      // Handle manual redetection from content script
      const tabId = sender.tab?.id;
      if (tabId && message.url && message.detection) {
        console.log(`🔄 [AUTO-DETECT] Manual redetection for tab ${tabId}:`);
        console.log(`🔄 [AUTO-DETECT] URL: ${message.url}`);
        console.log(`🔄 [AUTO-DETECT] Detection:`, message.detection);
        
        // Update stored tab info
        tabSiteInfo[tabId] = {
          url: message.url,
          detection: message.detection,
          timestamp: message.timestamp || Date.now()
        };
        
        // Update extension badge
        updateExtensionBadge(tabId, message.detection).catch((error) => {
          console.error(`❌ [AUTO-DETECT] Failed to update badge after manual redetection:`, error);
        });
        
        // Notify sidebar about the manual detection
        browser.runtime.sendMessage({
          type: 'MANUAL_DETECTION_COMPLETE',
          tabId: tabId,
          tabInfo: tabSiteInfo[tabId],
          timestamp: message.timestamp || Date.now()
        }).catch(() => {
          console.log(`📱 [AUTO-DETECT] Sidebar not open for manual detection notification`);
        });
        
        console.log(`✅ [AUTO-DETECT] Manual redetection completed for tab ${tabId}`);
      }
      sendResponse({ success: true });
    } else if (message.type === 'INITIAL_DETECTION') {
      // Handle initial detection from content script (for manual URL changes)
      const tabId = sender.tab?.id;
      if (tabId && message.url && message.detection) {
        console.log(`🚀 [AUTO-DETECT] Initial detection for tab ${tabId}:`);
        console.log(`🚀 [AUTO-DETECT] URL: ${message.url}`);
        console.log(`🚀 [AUTO-DETECT] Detection:`, message.detection);
        
        // Update stored tab info
        tabSiteInfo[tabId] = {
          url: message.url,
          detection: message.detection,
          timestamp: message.timestamp || Date.now()
        };
        
        // Update extension badge
        updateExtensionBadge(tabId, message.detection).catch((error) => {
          console.error(`❌ [AUTO-DETECT] Failed to update badge after initial detection:`, error);
        });
        
        // Notify sidebar about the initial detection
        browser.runtime.sendMessage({
          type: 'INITIAL_DETECTION_COMPLETE',
          tabId: tabId,
          tabInfo: tabSiteInfo[tabId],
          timestamp: message.timestamp || Date.now()
        }).catch(() => {
          console.log(`📱 [AUTO-DETECT] Sidebar not open for initial detection notification`);
        });
        
        console.log(`✅ [AUTO-DETECT] Initial detection completed for tab ${tabId}`);
      }
      sendResponse({ success: true });
    } else if (message.type === 'GET_SITE_DETECTION') {
      // Return current site detection for a tab
      const tabId = message.tabId || sender.tab?.id;
      if (tabId && tabSiteInfo[tabId]) {
        sendResponse(tabSiteInfo[tabId]);
      } else {
        sendResponse(null);
      }
    } else if (message.type === 'SET_AUTO_DETECTION_SETTINGS') {
      // Update auto-detection settings
      autoDetectionEnabled = message.autoDetectionEnabled !== undefined ? message.autoDetectionEnabled : autoDetectionEnabled;
      console.log('🔧 [AUTO-DETECT] Settings updated:', { autoDetectionEnabled });
      sendResponse({ success: true });
    } else if (message.type === 'GET_ALL_TAB_INFO') {
      // Return information about all tabs for debugging
      const tabInfo = Object.keys(tabSiteInfo).map(tabId => ({
        tabId: parseInt(tabId),
        ...tabSiteInfo[parseInt(tabId)]
      }));
      sendResponse({ 
        success: true, 
        tabs: tabInfo,
        settings: { autoDetectionEnabled }
      });
    } else if (message.type === 'GMAIL_DATA') {
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
    } else if (message.type === 'REPORT_SUBMITTED') {
      // Store report success for this analysis
      const tabId = sender.tab?.id || message.tabId;
      if (tabId && message.analysisData && message.scamType && message.reportId) {
        const analysisHash = generateAnalysisHash(message.analysisData, message.scamType);
        const reportKey = getReportKey(tabId, analysisHash);
        
        reportStatus[reportKey] = {
          reportId: message.reportId,
          timestamp: Date.now(),
          scamType: message.scamType,
          analysisData: message.analysisData
        };
        
        console.log(`📢 [REPORT] Stored report status for tab ${tabId}:`, reportKey, message.reportId);
      }
      sendResponse({ success: true });
    } else if (message.type === 'GET_REPORT_STATUS') {
      // Check if this analysis has been reported
      const tabId = sender.tab?.id || message.tabId;
      if (tabId && message.analysisData && message.scamType) {
        const analysisHash = generateAnalysisHash(message.analysisData, message.scamType);
        const reportKey = getReportKey(tabId, analysisHash);
        const status = reportStatus[reportKey];
        
        console.log(`📢 [REPORT] Report status check for tab ${tabId}:`, reportKey, status ? 'reported' : 'not reported');
        
        sendResponse({
          success: true,
          reported: !!status,
          reportId: status?.reportId,
          timestamp: status?.timestamp
        });
      } else {
        sendResponse({ success: true, reported: false });
      }
    } else if (message.type === 'CLEAR_REPORT_STATUS') {
      // Clear report status for tab switch or new analysis
      const tabId = sender.tab?.id || message.tabId;
      if (tabId) {
        // Clear all report status for this tab
        Object.keys(reportStatus).forEach(key => {
          if (key.startsWith(`${tabId}-`)) {
            delete reportStatus[key];
          }
        });
        console.log(`📢 [REPORT] Cleared report status for tab ${tabId}`);
      }
      sendResponse({ success: true });
    } else if (message.type === 'STORE_ANALYSIS_STATE') {
      // Store analysis result and extracted data for tab persistence
      const tabId = sender.tab?.id || message.tabId;
      if (tabId && message.analysisResult) {
        const analysisData = message.extractedData || message.websiteData || message.facebookData;
        const analysisHash = generateAnalysisHash(analysisData, message.scamType);
        const reportKey = getReportKey(tabId, analysisHash);
        const existingReport = reportStatus[reportKey];
        
        tabAnalysisState[tabId] = {
          analysisResult: message.analysisResult,
          extractedData: message.extractedData,
          websiteData: message.websiteData,
          facebookData: message.facebookData,
          scamType: message.scamType,
          timestamp: Date.now(),
          reportStatus: existingReport ? { reportId: existingReport.reportId, timestamp: existingReport.timestamp } : undefined
        };
        
        console.log(`💾 [ANALYSIS] Stored analysis state for tab ${tabId}:`, message.scamType);
      }
      sendResponse({ success: true });
    } else if (message.type === 'GET_ANALYSIS_STATE') {
      // Get stored analysis state for current tab
      const tabId = sender.tab?.id || message.tabId;
      if (tabId && tabAnalysisState[tabId]) {
        const state = tabAnalysisState[tabId];
        console.log(`📥 [ANALYSIS] Retrieved analysis state for tab ${tabId}:`, state.scamType);
        sendResponse({
          success: true,
          analysisResult: state.analysisResult,
          extractedData: state.extractedData,
          websiteData: state.websiteData,
          facebookData: state.facebookData,
          scamType: state.scamType,
          reportStatus: state.reportStatus
        });
      } else {
        sendResponse({ success: true, analysisResult: null });
      }
    } else if (message.type === 'CLEAR_ANALYSIS_STATE') {
      // Clear analysis state for current tab
      const tabId = sender.tab?.id || message.tabId;
      if (tabId) {
        delete tabAnalysisState[tabId];
        console.log(`🗑️ [ANALYSIS] Cleared analysis state for tab ${tabId}`);
      }
      sendResponse({ success: true });
    }
  });

  console.log('Background script initialized');
});
