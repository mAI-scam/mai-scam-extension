// URL Detection Utilities for Automatic Scam Type Detection

export type DetectedSiteType = 'email' | 'social' | 'website' | 'search' | 'banking' | 'ecommerce';

export interface SiteDetectionResult {
  type: DetectedSiteType;
  platform?: string; // 'gmail', 'facebook', etc.
  confidence: number; // 0-1, how confident we are in the detection
  category?: string; // Additional categorization for better analysis
}

// Gmail URL patterns - Enhanced for better detection
const GMAIL_PATTERNS = [
  /^https:\/\/mail\.google\.com\/.*/,
  /^https:\/\/gmail\.com\/.*/,
  /^https:\/\/[^.]+\.mail\.google\.com\/.*/,
  // Google account transitions to Gmail
  /^https:\/\/accounts\.google\.com\/.*mail\.google\.com.*/,
  /^https:\/\/www\.google\.com\/.*gmail.*/,
  // Gmail mobile and app redirects
  /^https:\/\/m\.gmail\.com\/.*/,
  /^https:\/\/mobile\.gmail\.com\/.*/
];

// Email platforms (expandable)
const EMAIL_PATTERNS = [
  ...GMAIL_PATTERNS,
  // Outlook/Hotmail
  /^https:\/\/outlook\.live\.com\/.*/,
  /^https:\/\/outlook\.office\.com\/.*/,
  /^https:\/\/outlook\.office365\.com\/.*/,
  /^https:\/\/[^.]+\.outlook\.com\/.*/,
  /^https:\/\/hotmail\.com\/.*/,
  /^https:\/\/www\.hotmail\.com\/.*/,
  // Yahoo Mail
  /^https:\/\/mail\.yahoo\.com\/.*/,
  /^https:\/\/[^.]+\.mail\.yahoo\.com\/.*/,
  // ProtonMail
  /^https:\/\/mail\.protonmail\.com\/.*/,
  /^https:\/\/mail\.proton\.me\/.*/,
  // Other email services
  /^https:\/\/mail\.aol\.com\/.*/,
  /^https:\/\/webmail\..*/,
  /^https:\/\/.*\/webmail.*/,
  /^https:\/\/.*\/mail.*/
];

// Facebook URL patterns - Enhanced
const FACEBOOK_PATTERNS = [
  /^https:\/\/(www\.)?facebook\.com\/.*/,
  /^https:\/\/(www\.)?fb\.com\/.*/,
  /^https:\/\/m\.facebook\.com\/.*/,
  /^https:\/\/mobile\.facebook\.com\/.*/,
  /^https:\/\/[^.]+\.facebook\.com\/.*/, // subdomains
  /^https:\/\/business\.facebook\.com\/.*/,
  /^https:\/\/developers\.facebook\.com\/.*/
];

// Twitter/X patterns - Enhanced
const TWITTER_PATTERNS = [
  /^https:\/\/(www\.)?twitter\.com\/.*/,
  /^https:\/\/(www\.)?x\.com\/.*/,
  /^https:\/\/mobile\.twitter\.com\/.*/,
  /^https:\/\/m\.twitter\.com\/.*/,
  /^https:\/\/tweetdeck\.twitter\.com\/.*/
];

// LinkedIn patterns - Enhanced
const LINKEDIN_PATTERNS = [
  /^https:\/\/(www\.)?linkedin\.com\/.*/,
  /^https:\/\/[a-z]{2}\.linkedin\.com\/.*/, // country-specific
  /^https:\/\/m\.linkedin\.com\/.*/,
  /^https:\/\/mobile\.linkedin\.com\/.*/
];

// Instagram patterns - Enhanced
const INSTAGRAM_PATTERNS = [
  /^https:\/\/(www\.)?instagram\.com\/.*/,
  /^https:\/\/m\.instagram\.com\/.*/,
  /^https:\/\/[^.]+\.instagram\.com\/.*/
];

// YouTube patterns - Enhanced
const YOUTUBE_PATTERNS = [
  /^https:\/\/(www\.)?youtube\.com\/.*/,
  /^https:\/\/m\.youtube\.com\/.*/,
  /^https:\/\/music\.youtube\.com\/.*/,
  /^https:\/\/studio\.youtube\.com\/.*/,
  /^https:\/\/youtu\.be\/.*/
];

// TikTok patterns - Enhanced
const TIKTOK_PATTERNS = [
  /^https:\/\/(www\.)?tiktok\.com\/.*/,
  /^https:\/\/m\.tiktok\.com\/.*/,
  /^https:\/\/[a-z]{2}\.tiktok\.com\/.*/, // country-specific
  /^https:\/\/vm\.tiktok\.com\/.*/ // short links
];

// Social media platforms to detect (expandable and organized)
const SOCIAL_MEDIA_PATTERNS = [
  ...FACEBOOK_PATTERNS,
  ...TWITTER_PATTERNS,
  ...LINKEDIN_PATTERNS,
  ...INSTAGRAM_PATTERNS,
  ...YOUTUBE_PATTERNS,
  ...TIKTOK_PATTERNS,
  // Reddit
  /^https:\/\/(www\.)?reddit\.com\/.*/,
  /^https:\/\/m\.reddit\.com\/.*/,
  /^https:\/\/old\.reddit\.com\/.*/,
  // Discord
  /^https:\/\/(www\.)?discord\.com\/.*/,
  /^https:\/\/discord\.gg\/.*/,
  // Telegram
  /^https:\/\/(www\.)?telegram\.org\/.*/,
  /^https:\/\/web\.telegram\.org\/.*/,
  /^https:\/\/t\.me\/.*/,
  // WhatsApp
  /^https:\/\/(www\.)?whatsapp\.com\/.*/,
  /^https:\/\/web\.whatsapp\.com\/.*/,
  /^https:\/\/wa\.me\/.*/,
  // Snapchat
  /^https:\/\/(www\.)?snapchat\.com\/.*/,
  /^https:\/\/web\.snapchat\.com\/.*/,
  // Pinterest
  /^https:\/\/(www\.)?pinterest\.com\/.*/,
  /^https:\/\/[a-z]{2}\.pinterest\.com\/.*/, // country-specific
  // Twitch
  /^https:\/\/(www\.)?twitch\.tv\/.*/,
  /^https:\/\/m\.twitch\.tv\/.*/,
  // Clubhouse
  /^https:\/\/(www\.)?clubhouse\.com\/.*/,
  // Mastodon and other decentralized
  /^https:\/\/.*\.social\/.*/,
  /^https:\/\/mastodon\..*/
];

// Search engines and their patterns
const SEARCH_ENGINE_PATTERNS = [
  /^https:\/\/(www\.)?google\.[a-z.]{2,6}\/search.*/,
  /^https:\/\/search\.yahoo\.com\/.*/,
  /^https:\/\/(www\.)?bing\.com\/search.*/,
  /^https:\/\/(www\.)?duckduckgo\.com\/.*/,
  /^https:\/\/(www\.)?startpage\.com\/.*/,
  /^https:\/\/(www\.)?ecosia\.org\/.*/,
  /^https:\/\/(www\.)?yandex\.[a-z]{2,3}\/search.*/
];

// Banking and financial sites
const BANKING_PATTERNS = [
  /^https:\/\/.*bank.*\.com\/.*/,
  /^https:\/\/.*banking.*\.com\/.*/,
  /^https:\/\/(www\.)?paypal\.com\/.*/,
  /^https:\/\/(www\.)?stripe\.com\/.*/,
  /^https:\/\/(www\.)?square\.com\/.*/,
  /^https:\/\/.*\.wellsfargo\.com\/.*/,
  /^https:\/\/.*\.bankofamerica\.com\/.*/,
  /^https:\/\/.*\.chase\.com\/.*/,
  /^https:\/\/.*\.citibank\.com\/.*/
];

// Shopping and e-commerce
const ECOMMERCE_PATTERNS = [
  /^https:\/\/(www\.)?amazon\.[a-z.]{2,6}\/.*/,
  /^https:\/\/(www\.)?ebay\.[a-z.]{2,6}\/.*/,
  /^https:\/\/(www\.)?etsy\.com\/.*/,
  /^https:\/\/(www\.)?shopify\.com\/.*/,
  /^https:\/\/.*\.shopify\.com\/.*/,
  /^https:\/\/(www\.)?alibaba\.com\/.*/,
  /^https:\/\/(www\.)?aliexpress\.com\/.*/,
  /^https:\/\/(www\.)?walmart\.com\/.*/,
  /^https:\/\/(www\.)?target\.com\/.*/
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
 * Detects the type of website based on the URL with comprehensive pattern matching
 * @param url - The URL to analyze
 * @returns SiteDetectionResult with detection details
 */
export function detectSiteType(url: string): SiteDetectionResult {
  if (!url || typeof url !== 'string') {
    return {
      type: 'website',
      confidence: 0,
      category: 'unknown'
    };
  }

  // Check if URL should be excluded from analysis
  if (EXCLUDED_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'website',
      confidence: 0,
      category: 'system'
    };
  }

  // EMAIL DETECTION - Check all email platforms
  if (EMAIL_PATTERNS.some(pattern => pattern.test(url))) {
    let platform = 'generic';
    let confidence = 0.8;
    
    if (GMAIL_PATTERNS.some(pattern => pattern.test(url))) {
      platform = 'gmail';
      confidence = 0.95;
    } else if (url.includes('outlook') || url.includes('hotmail')) {
      platform = 'outlook';
      confidence = 0.9;
    } else if (url.includes('yahoo')) {
      platform = 'yahoo';
      confidence = 0.9;
    } else if (url.includes('proton')) {
      platform = 'protonmail';
      confidence = 0.9;
    }
    
    return {
      type: 'email',
      platform,
      confidence,
      category: 'communication'
    };
  }

  // SOCIAL MEDIA DETECTION - Check specific platforms first
  if (FACEBOOK_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'social',
      platform: 'facebook',
      confidence: 0.95,
      category: 'social_network'
    };
  }
  
  if (TWITTER_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'social',
      platform: 'twitter',
      confidence: 0.95,
      category: 'microblogging'
    };
  }
  
  if (LINKEDIN_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'social',
      platform: 'linkedin',
      confidence: 0.95,
      category: 'professional_network'
    };
  }
  
  if (INSTAGRAM_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'social',
      platform: 'instagram',
      confidence: 0.95,
      category: 'photo_sharing'
    };
  }
  
  if (YOUTUBE_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'social',
      platform: 'youtube',
      confidence: 0.95,
      category: 'video_sharing'
    };
  }
  
  if (TIKTOK_PATTERNS.some(pattern => pattern.test(url))) {
    return {
      type: 'social',
      platform: 'tiktok',
      confidence: 0.95,
      category: 'short_video'
    };
  }

  // Check for other social media platforms
  if (SOCIAL_MEDIA_PATTERNS.some(pattern => pattern.test(url))) {
    let platform = 'other';
    let category = 'social_network';
    
    if (url.includes('reddit')) {
      platform = 'reddit';
      category = 'forum';
    } else if (url.includes('discord')) {
      platform = 'discord';
      category = 'messaging';
    } else if (url.includes('telegram')) {
      platform = 'telegram';
      category = 'messaging';
    } else if (url.includes('whatsapp')) {
      platform = 'whatsapp';
      category = 'messaging';
    } else if (url.includes('pinterest')) {
      platform = 'pinterest';
      category = 'content_discovery';
    } else if (url.includes('twitch')) {
      platform = 'twitch';
      category = 'live_streaming';
    }
    
    return {
      type: 'social',
      platform,
      confidence: 0.85,
      category
    };
  }

  // SEARCH ENGINE DETECTION
  if (SEARCH_ENGINE_PATTERNS.some(pattern => pattern.test(url))) {
    let platform = 'generic';
    
    if (url.includes('google')) {
      platform = 'google';
    } else if (url.includes('bing')) {
      platform = 'bing';
    } else if (url.includes('yahoo')) {
      platform = 'yahoo';
    } else if (url.includes('duckduckgo')) {
      platform = 'duckduckgo';
    }
    
    return {
      type: 'search',
      platform,
      confidence: 0.9,
      category: 'search_engine'
    };
  }

  // BANKING DETECTION
  if (BANKING_PATTERNS.some(pattern => pattern.test(url))) {
    let platform = 'generic';
    
    if (url.includes('paypal')) {
      platform = 'paypal';
    } else if (url.includes('chase')) {
      platform = 'chase';
    } else if (url.includes('wellsfargo')) {
      platform = 'wells_fargo';
    } else if (url.includes('bankofamerica')) {
      platform = 'bank_of_america';
    }
    
    return {
      type: 'banking',
      platform,
      confidence: 0.9,
      category: 'financial_services'
    };
  }

  // ECOMMERCE DETECTION
  if (ECOMMERCE_PATTERNS.some(pattern => pattern.test(url))) {
    let platform = 'generic';
    
    if (url.includes('amazon')) {
      platform = 'amazon';
    } else if (url.includes('ebay')) {
      platform = 'ebay';
    } else if (url.includes('etsy')) {
      platform = 'etsy';
    } else if (url.includes('shopify')) {
      platform = 'shopify';
    } else if (url.includes('walmart')) {
      platform = 'walmart';
    } else if (url.includes('target')) {
      platform = 'target';
    }
    
    return {
      type: 'ecommerce',
      platform,
      confidence: 0.85,
      category: 'online_shopping'
    };
  }

  // Default to website for everything else
  return {
    type: 'website',
    platform: 'generic',
    confidence: 0.7,
    category: 'general_website'
  };
}

/**
 * Determines if a URL change is significant enough to trigger re-analysis
 * @param oldUrl - Previous URL
 * @param newUrl - New URL
 * @returns boolean indicating if analysis should be triggered
 */
export function isSignificantUrlChange(oldUrl: string, newUrl: string): boolean {
  if (!oldUrl || !newUrl) {
    console.log('🔍 [URL-DETECTION] Empty URL detected, considering significant');
    return true;
  }

  // Log the URLs being compared for debugging
  console.log('🔍 [URL-DETECTION] Comparing URLs:');
  console.log('🔍 [URL-DETECTION] Old:', oldUrl);
  console.log('🔍 [URL-DETECTION] New:', newUrl);

  // Remove hash fragments and query parameters for comparison
  const cleanOldUrl = oldUrl.split('#')[0].split('?')[0];
  const cleanNewUrl = newUrl.split('#')[0].split('?')[0];

  // Check for cross-domain changes (always significant)
  try {
    const oldDomain = new URL(oldUrl).hostname;
    const newDomain = new URL(newUrl).hostname;
    
    console.log(`🔍 [URL-DETECTION] Domain comparison: ${oldDomain} vs ${newDomain}`);
    
    if (oldDomain !== newDomain) {
      console.log(`🔍 [URL-DETECTION] ✅ SIGNIFICANT: Domain change detected: ${oldDomain} -> ${newDomain}`);
      return true;
    }
  } catch (error) {
    console.error('❌ [URL-DETECTION] Error parsing URLs for domain comparison:', error);
    return true; // Err on the side of caution
  }

  // Check for site type changes (e.g., Google search -> Gmail)
  const oldDetection = detectSiteType(oldUrl);
  const newDetection = detectSiteType(newUrl);
  
  console.log('🔍 [URL-DETECTION] Site type comparison:');
  console.log('🔍 [URL-DETECTION] Old detection:', oldDetection);
  console.log('🔍 [URL-DETECTION] New detection:', newDetection);
  
  if (oldDetection.type !== newDetection.type || oldDetection.platform !== newDetection.platform) {
    console.log(`🔍 [URL-DETECTION] ✅ SIGNIFICANT: Site type change detected: ${oldDetection.type}/${oldDetection.platform} -> ${newDetection.type}/${newDetection.platform}`);
    return true;
  }

  // Additional check: if confidence levels are very different, consider it significant
  const confidenceDiff = Math.abs(oldDetection.confidence - newDetection.confidence);
  if (confidenceDiff > 0.3) {
    console.log(`🔍 [URL-DETECTION] ✅ SIGNIFICANT: Large confidence difference: ${oldDetection.confidence} -> ${newDetection.confidence}`);
    return true;
  }

  // If the base URLs are the same, check for specific patterns that indicate significant changes
  if (cleanOldUrl === cleanNewUrl) {
    // Check for Gmail specific changes (compose, thread navigation, etc.)
    if (GMAIL_PATTERNS.some(pattern => pattern.test(newUrl))) {
      // Gmail inbox/thread changes are significant
      return oldUrl !== newUrl && (
        newUrl.includes('#inbox') ||
        newUrl.includes('#compose') ||
        newUrl.includes('/mail/u/') ||
        newUrl.includes('#thread') ||
        newUrl.includes('#drafts') ||
        newUrl.includes('#sent') ||
        newUrl.includes('#spam') ||
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
        newUrl.includes('/groups/') ||
        newUrl.includes('/marketplace/') ||
        oldUrl.includes('?') !== newUrl.includes('?')
      );
    }

    // For other sites, only fragment/query changes are not significant
    console.log('🔍 [URL-DETECTION] ❌ NOT SIGNIFICANT: Same base URL, only fragment/query changes');
    return false;
  }

  // Different base URLs are always significant
  console.log(`🔍 [URL-DETECTION] ✅ SIGNIFICANT: Different base URLs: ${cleanOldUrl} vs ${cleanNewUrl}`);
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
      if (result.platform === 'gmail') return 'Gmail';
      if (result.platform === 'outlook') return 'Outlook';
      if (result.platform === 'yahoo') return 'Yahoo Mail';
      if (result.platform === 'protonmail') return 'ProtonMail';
      return 'Email Service';
    case 'social':
      if (result.platform === 'facebook') return 'Facebook';
      if (result.platform === 'twitter') return 'Twitter/X';
      if (result.platform === 'instagram') return 'Instagram';
      if (result.platform === 'linkedin') return 'LinkedIn';
      if (result.platform === 'youtube') return 'YouTube';
      if (result.platform === 'tiktok') return 'TikTok';
      if (result.platform === 'reddit') return 'Reddit';
      if (result.platform === 'discord') return 'Discord';
      return 'Social Media';
    case 'search':
      if (result.platform === 'google') return 'Google Search';
      if (result.platform === 'bing') return 'Bing Search';
      if (result.platform === 'yahoo') return 'Yahoo Search';
      if (result.platform === 'duckduckgo') return 'DuckDuckGo';
      return 'Search Engine';
    case 'banking':
      if (result.platform === 'paypal') return 'PayPal';
      if (result.platform === 'chase') return 'Chase Bank';
      if (result.platform === 'wells_fargo') return 'Wells Fargo';
      if (result.platform === 'bank_of_america') return 'Bank of America';
      return 'Banking Service';
    case 'ecommerce':
      if (result.platform === 'amazon') return 'Amazon';
      if (result.platform === 'ebay') return 'eBay';
      if (result.platform === 'etsy') return 'Etsy';
      if (result.platform === 'walmart') return 'Walmart';
      if (result.platform === 'target') return 'Target';
      return 'E-commerce Site';
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
  // Email platforms with dedicated extraction logic
  if (result.type === 'email') {
    return result.platform === 'gmail'; // Currently only Gmail has extraction
  }
  
  // Social media platforms with dedicated extraction logic
  if (result.type === 'social') {
    return result.platform === 'facebook'; // Currently only Facebook has extraction
  }
  
  // All website types support general content extraction
  if (result.type === 'website') return true;
  
  // Search engines, banking, and ecommerce use general website extraction
  if (result.type === 'search') return true;
  if (result.type === 'banking') return true;
  if (result.type === 'ecommerce') return true;

  return false;
}

/**
 * Get confidence threshold for triggering auto-analysis
 * @param result - Site detection result
 * @returns confidence threshold (0-1)
 */
export function getAutoAnalysisThreshold(result: SiteDetectionResult): number {
  switch (result.type) {
    case 'email':
      return 0.8; // High confidence needed for email
    case 'social':
      return 0.7; // Medium-high confidence for social media
    case 'banking':
      return 0.9; // Very high confidence for banking (security-sensitive)
    case 'ecommerce':
      return 0.7; // Medium-high confidence for shopping
    case 'search':
      return 0.6; // Lower confidence for search (less critical)
    case 'website':
    default:
      return 0.5; // Lower confidence for general websites
  }
}

/**
 * Determine if a site type should trigger enhanced security scanning
 * @param result - Site detection result
 * @returns boolean indicating if enhanced scanning is recommended
 */
export function requiresEnhancedSecurity(result: SiteDetectionResult): boolean {
  // Banking sites always need enhanced security
  if (result.type === 'banking') return true;
  
  // Email sites need enhanced security
  if (result.type === 'email') return true;
  
  // E-commerce sites handling payments need enhanced security
  if (result.type === 'ecommerce') return true;
  
  // Social media can contain phishing attempts
  if (result.type === 'social') return true;
  
  return false;
}
