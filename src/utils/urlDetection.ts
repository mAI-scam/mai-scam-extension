// URL Detection Utilities for Automatic Scam Type Detection

export type DetectedSiteType = 'email' | 'social' | 'website';

export interface SiteDetectionResult {
  type: DetectedSiteType;
  platform?: string; // 'gmail', 'facebook', etc.
  confidence: number; // 0-1, how confident we are in the detection
}

// Gmail URL patterns
const GMAIL_PATTERNS = [
  /^https:\/\/mail\.google\.com\/.*/,
  /^https:\/\/gmail\.com\/.*/,
  /^https:\/\/[^.]+\.mail\.google\.com\/.*/
];

// Facebook URL patterns
const FACEBOOK_PATTERNS = [
  /^https:\/\/(www\.)?facebook\.com\/.*/,
  /^https:\/\/(www\.)?fb\.com\/.*/,
  /^https:\/\/m\.facebook\.com\/.*/,
  /^https:\/\/mobile\.facebook\.com\/.*/,
  /^https:\/\/[^.]+\.facebook\.com\/.*/ // subdomains
];

// Social media platforms to detect (expandable)
const SOCIAL_MEDIA_PATTERNS = [
  ...FACEBOOK_PATTERNS,
  /^https:\/\/(www\.)?twitter\.com\/.*/,
  /^https:\/\/(www\.)?x\.com\/.*/,
  /^https:\/\/(www\.)?instagram\.com\/.*/,
  /^https:\/\/(www\.)?linkedin\.com\/.*/,
  /^https:\/\/(www\.)?tiktok\.com\/.*/,
  /^https:\/\/(www\.)?youtube\.com\/.*/,
  /^https:\/\/(www\.)?reddit\.com\/.*/,
  /^https:\/\/(www\.)?discord\.com\/.*/,
  /^https:\/\/(www\.)?telegram\.org\/.*/,
  /^https:\/\/(www\.)?whatsapp\.com\/.*/
];

// URLs that should not be analyzed (system pages, extensions, etc.)
const EXCLUDED_PATTERNS = [
  /^chrome:\/\/.*/,
  /^chrome-extension:\/\/.*/,
  /^moz-extension:\/\/.*/,
  /^about:.*/,
  /^file:\/\/.*/,
  /^data:.*/,
  /^blob:.*/,
  /^javascript:.*/,
  /^localhost/,
  /^127\.0\.0\.1/,
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./
];

/**
 * Detects the type of website based on the URL
 * @param url - The URL to analyze
 * @returns SiteDetectionResult with detection details
 */
export function detectSiteType(url: string): SiteDetectionResult {
  if (!url || typeof url !== 'string') {
    return {
      type: 'website',
      confidence: 0
    };
  }

  // Check if URL should be excluded from analysis
  if (EXCLUDED_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'website',
      confidence: 0
    };
  }

  // Check for Gmail
  if (GMAIL_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'email',
      platform: 'gmail',
      confidence: 0.95
    };
  }

  // Check for Facebook specifically (since we have special handling)
  if (FACEBOOK_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'social',
      platform: 'facebook',
      confidence: 0.95
    };
  }

  // Check for other social media platforms
  if (SOCIAL_MEDIA_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'social',
      platform: 'other',
      confidence: 0.8
    };
  }

  // Default to website for everything else
  return {
    type: 'website',
    platform: 'generic',
    confidence: 0.7
  };
}

/**
 * Determines if a URL change is significant enough to trigger re-analysis
 * @param oldUrl - Previous URL
 * @param newUrl - New URL
 * @returns boolean indicating if analysis should be triggered
 */
export function isSignificantUrlChange(oldUrl: string, newUrl: string): boolean {
  if (!oldUrl || !newUrl) return true;

  // Remove hash fragments and query parameters for comparison
  const cleanOldUrl = oldUrl.split('#')[0].split('?')[0];
  const cleanNewUrl = newUrl.split('#')[0].split('?')[0];

  // If the base URLs are the same, check for specific patterns that indicate significant changes
  if (cleanOldUrl === cleanNewUrl) {
    // Check for Gmail specific changes (compose, thread navigation, etc.)
    if (GMAIL_PATTERNS.some(pattern => pattern.test(newUrl))) {
      // Gmail inbox/thread changes are significant
      return oldUrl !== newUrl && (
        newUrl.includes('#inbox') ||
        newUrl.includes('#compose') ||
        newUrl.includes('/mail/u/') ||
        oldUrl.includes('#') !== newUrl.includes('#')
      );
    }

    // Check for Facebook specific changes (post navigation, etc.)
    if (FACEBOOK_PATTERNS.some(pattern => pattern.test(newUrl))) {
      // Facebook navigation changes are significant
      return oldUrl !== newUrl && (
        newUrl.includes('/posts/') ||
        newUrl.includes('/photo.php') ||
        newUrl.includes('/story.php') ||
        oldUrl.includes('?') !== newUrl.includes('?')
      );
    }

    // For other sites, only fragment/query changes are not significant
    return false;
  }

  return true;
}

/**
 * Get appropriate analysis function based on detected site type
 * @param siteType - The detected site type
 * @returns string indicating which analysis method to use
 */
export function getAnalysisMethod(siteType: DetectedSiteType, platform?: string): string {
  switch (siteType) {
    case 'email':
      return 'analyzeEmail';
    case 'social':
      if (platform === 'facebook') {
        return 'analyzeFacebook';
      }
      return 'analyzeSocialMedia';
    case 'website':
    default:
      return 'analyzeWebsite';
  }
}

/**
 * Get display name for detected site type
 * @param result - Site detection result
 * @returns user-friendly display name
 */
export function getSiteTypeDisplayName(result: SiteDetectionResult): string {
  switch (result.type) {
    case 'email':
      return result.platform === 'gmail' ? 'Gmail Email' : 'Email';
    case 'social':
      return result.platform === 'facebook' ? 'Facebook' : 'Social Media';
    case 'website':
    default:
      return 'Website';
  }
}

/**
 * Check if a site supports content extraction
 * @param result - Site detection result
 * @returns boolean indicating if content extraction is supported
 */
export function supportsContentExtraction(result: SiteDetectionResult): boolean {
  // Gmail and Facebook have dedicated extraction logic
  if (result.type === 'email' && result.platform === 'gmail') return true;
  if (result.type === 'social' && result.platform === 'facebook') return true;
  if (result.type === 'website') return true;

  return false;
}
