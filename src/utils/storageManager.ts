// Storage Manager for Auto-Detection Settings

export interface AutoDetectionSettings {
  autoDetectionEnabled: boolean;
  lastUpdated: number;
}

export interface AnalysisHistory {
  id: string;
  url: string;
  siteType: string;
  platform?: string;
  timestamp: number;
  riskLevel?: string;
  userTriggered: boolean; // true if manually triggered, false if auto-triggered
}

// Storage keys
const STORAGE_KEYS = {
  AUTO_DETECTION_SETTINGS: 'maiscam_auto_detection_settings',
  ANALYSIS_HISTORY: 'maiscam_analysis_history',
  USER_PREFERENCES: 'maiscam_user_preferences'
} as const;

// Default settings
const DEFAULT_SETTINGS: AutoDetectionSettings = {
  autoDetectionEnabled: true,
  lastUpdated: Date.now()
};

/**
 * Get auto-detection settings from storage
 */
export async function getAutoDetectionSettings(): Promise<AutoDetectionSettings> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.AUTO_DETECTION_SETTINGS);
    const stored = result[STORAGE_KEYS.AUTO_DETECTION_SETTINGS];
    
    if (stored && typeof stored === 'object') {
      return {
        ...DEFAULT_SETTINGS,
        ...stored
      };
    }
    
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to get auto-detection settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save auto-detection settings to storage
 */
export async function saveAutoDetectionSettings(settings: Partial<AutoDetectionSettings>): Promise<void> {
  try {
    const currentSettings = await getAutoDetectionSettings();
    const updatedSettings: AutoDetectionSettings = {
      ...currentSettings,
      ...settings,
      lastUpdated: Date.now()
    };
    
    await browser.storage.local.set({
      [STORAGE_KEYS.AUTO_DETECTION_SETTINGS]: updatedSettings
    });
    
    console.log('📝 Auto-detection settings saved:', updatedSettings);
    
    // Notify background script of settings change
    browser.runtime.sendMessage({
      type: 'SET_AUTO_DETECTION_SETTINGS',
      autoDetectionEnabled: updatedSettings.autoDetectionEnabled
    }).catch(() => {
      // Background script might not be available
      console.log('Background script not available for settings update');
    });
    
  } catch (error) {
    console.error('Failed to save auto-detection settings:', error);
    throw error;
  }
}

/**
 * Add analysis to history
 */
export async function addAnalysisToHistory(analysis: Omit<AnalysisHistory, 'id' | 'timestamp'>): Promise<void> {
  try {
    const historyEntry: AnalysisHistory = {
      ...analysis,
      id: generateAnalysisId(),
      timestamp: Date.now()
    };
    
    // Get current history (limit to last 100 entries)
    const result = await browser.storage.local.get(STORAGE_KEYS.ANALYSIS_HISTORY);
    const currentHistory: AnalysisHistory[] = result[STORAGE_KEYS.ANALYSIS_HISTORY] || [];
    
    // Add new entry and maintain maximum size
    const updatedHistory = [historyEntry, ...currentHistory].slice(0, 100);
    
    await browser.storage.local.set({
      [STORAGE_KEYS.ANALYSIS_HISTORY]: updatedHistory
    });
    
    console.log('📊 Analysis added to history:', historyEntry);
    
  } catch (error) {
    console.error('Failed to add analysis to history:', error);
  }
}

/**
 * Get analysis history from storage
 */
export async function getAnalysisHistory(limit: number = 50): Promise<AnalysisHistory[]> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.ANALYSIS_HISTORY);
    const history: AnalysisHistory[] = result[STORAGE_KEYS.ANALYSIS_HISTORY] || [];
    
    return history.slice(0, limit);
  } catch (error) {
    console.error('Failed to get analysis history:', error);
    return [];
  }
}

/**
 * Clear analysis history
 */
export async function clearAnalysisHistory(): Promise<void> {
  try {
    await browser.storage.local.remove(STORAGE_KEYS.ANALYSIS_HISTORY);
    console.log('🗑️ Analysis history cleared');
  } catch (error) {
    console.error('Failed to clear analysis history:', error);
    throw error;
  }
}

/**
 * Get analysis statistics
 */
export async function getAnalysisStats(): Promise<{
  totalAnalyses: number;
  manualTriggered: number;
  byType: Record<string, number>;
  byRiskLevel: Record<string, number>;
}> {
  try {
    const history = await getAnalysisHistory(1000); // Get more data for stats
    
    const stats = {
      totalAnalyses: history.length,
      manualTriggered: history.filter(h => h.userTriggered).length,
      byType: {} as Record<string, number>,
      byRiskLevel: {} as Record<string, number>
    };
    
    // Count by type
    history.forEach(entry => {
      stats.byType[entry.siteType] = (stats.byType[entry.siteType] || 0) + 1;
      if (entry.riskLevel) {
        stats.byRiskLevel[entry.riskLevel] = (stats.byRiskLevel[entry.riskLevel] || 0) + 1;
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Failed to get analysis stats:', error);
    return {
      totalAnalyses: 0,
      manualTriggered: 0,
      byType: {},
      byRiskLevel: {}
    };
  }
}

/**
 * Initialize storage manager (call this when extension starts)
 */
export async function initializeStorageManager(): Promise<void> {
  try {
    // Ensure default settings exist
    const settings = await getAutoDetectionSettings();
    console.log('🔧 Storage manager initialized with settings:', settings);
    
    // Clean up old entries if needed
    await cleanupOldEntries();
    
  } catch (error) {
    console.error('Failed to initialize storage manager:', error);
  }
}

/**
 * Generate unique ID for analysis entries
 */
function generateAnalysisId(): string {
  return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clean up old entries to prevent storage bloat
 */
async function cleanupOldEntries(): Promise<void> {
  try {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const history = await getAnalysisHistory(1000);
    
    // Keep only entries from the last 30 days
    const recentHistory = history.filter(entry => entry.timestamp > thirtyDaysAgo);
    
    if (recentHistory.length < history.length) {
      await browser.storage.local.set({
        [STORAGE_KEYS.ANALYSIS_HISTORY]: recentHistory
      });
      console.log(`🧹 Cleaned up ${history.length - recentHistory.length} old analysis entries`);
    }
  } catch (error) {
    console.error('Failed to cleanup old entries:', error);
  }
}

/**
 * Export storage data for backup/debugging
 */
export async function exportStorageData(): Promise<string> {
  try {
    const [settings, history] = await Promise.all([
      getAutoDetectionSettings(),
      getAnalysisHistory(1000)
    ]);
    
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      settings,
      history
    };
    
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Failed to export storage data:', error);
    throw error;
  }
}

/**
 * Reset all storage data
 */
export async function resetStorageData(): Promise<void> {
  try {
    await browser.storage.local.clear();
    console.log('🔄 All storage data reset');
  } catch (error) {
    console.error('Failed to reset storage data:', error);
    throw error;
  }
}
