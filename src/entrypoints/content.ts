import { analyzeEmail, AnalysisRequest, AnalysisResponse } from '../utils/mockApi';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  main() {
    console.log('Content script loaded on:', window.location.hostname);
    
    // State management for Facebook extraction
    let facebookExtractionState: {
      inProgress: boolean;
      data: FacebookPostData | null;
      startTime: number | null;
    } = {
      inProgress: false,
      data: null,
      startTime: null
    };
    
    // Interface for Gmail data
    interface GmailData {
      subject: string;
      from: string;
      content: string;
    }

    // Interface for Website data
    interface WebsiteData {
      url: string;
      title: string;
      screenshot: string;
      metadata: {
        description?: string;
        keywords?: string;
        author?: string;
        domain: string;
        favicon?: string;
      };
    }

    // Interface for Facebook post data
    interface FacebookPostData {
      username: string;
      caption: string;
      image?: string;
      postUrl: string;
      timestamp?: string;
    }

    // Function to extract Gmail data
    function extractGmailData(): GmailData | null {
      try {
        console.log('Starting Gmail data extraction...');
        console.log('Current URL:', window.location.href);
        console.log('Is in spam folder:', window.location.href.includes('/spam'));
        
        // Gmail uses dynamic class names, so we'll use more reliable selectors
        
        // Get the subject - comprehensive selectors for Gmail subject
        let subject = 'No subject found';
        const subjectSelectors = [
          // Modern Gmail thread view
          '[data-thread-id] h2',
          '[data-legacy-thread-id] h2',
          // Gmail conversation view
          '.hP',
          '.bog',
          // Main area subject
          '[role="main"] h2',
          // Alternative subject selectors
          'h2[data-thread-perm-id]',
          '.thread-subject',
          // Fallback selectors
          'span[data-hovercard-id] + span',
          '.thread-title'
        ];

        for (const selector of subjectSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent?.trim()) {
            subject = element.textContent.trim();
            console.log(`Subject found with selector: ${selector} -> "${subject}"`);
            break;
          }
        }

        // Get the sender - comprehensive selectors for Gmail sender including spam folder
        let from = 'No sender found';
        const fromSelectors = [
          // Spam folder specific selectors
          '.gD[email]', // Spam folder email attribute
          '.gD .go[email]', // Spam folder sender with email attribute
          '.gD span[email]', // Direct email in spam
          '.qu span[email]', // Quoted content email
          
          // Standard email attribute selectors (most reliable)
          '.yW span[email]',
          '.qu .go span[email]',
          '.go .g2[email]',
          'span[email]',
          
          // Message header selectors for spam
          '.gE .gD', // Spam message header
          '.gE .go', // Spam sender info
          '.gE span[title]', // Spam sender with title attribute
          
          // Name and email combination
          '.yW .yP',
          '.go .g2',
          '.qu .go .g2',
          '.gD .yP', // Spam folder name
          
          // Alternative sender selectors
          '.yW > span:first-child',
          '.gD > span:first-child', // Spam folder first span
          '.sender-name',
          '.from-name',
          
          // Hovercard selectors
          'span[data-hovercard-id]',
          
          // Raw header information (for spam emails)
          '.adn .afn', // Raw headers in expanded view
          '.afn .g2', // Raw sender info
          
          // Fallback text-based selectors
          '.yW span:not([style*="display: none"])',
          '.gD span:not([style*="display: none"])', // Spam folder fallback
          '.message-sender'
        ];

        // Additional method: Try to extract from message headers or raw view
        let foundSender = false;
        for (const selector of fromSelectors) {
          const element = document.querySelector(selector);
          if (element && !foundSender) {
            // Try to get email attribute first
            const email = element.getAttribute('email');
            if (email && email !== 'no-reply@accounts.google.com') { // Avoid Google system emails
              from = email;
              console.log(`From email found with selector: ${selector} -> "${email}"`);
              foundSender = true;
              break;
            }
            
            // Try title attribute (sometimes contains email)
            const title = element.getAttribute('title');
            if (title && title.includes('@') && !title.includes('no-reply@accounts.google.com')) {
              from = title;
              console.log(`From title found with selector: ${selector} -> "${title}"`);
              foundSender = true;
              break;
            }
            
            // Then try text content
            const textContent = element.textContent?.trim();
            if (textContent && textContent !== '' && !textContent.includes('•') && 
                !textContent.includes('no-reply@accounts.google.com')) {
              // Extract email from text if present
              const emailMatch = textContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              if (emailMatch) {
                from = emailMatch[0];
                console.log(`From email extracted from text with selector: ${selector} -> "${emailMatch[0]}"`);
                foundSender = true;
                break;
              } else if (textContent.length > 0) {
                from = textContent;
                console.log(`From text found with selector: ${selector} -> "${textContent}"`);
                foundSender = true;
                break;
              }
            }
          }
        }

        // Try to expand collapsed message details if available
        if (!foundSender || from === 'No sender found') {
          console.log('Attempting to expand message details...');
          
          // Look for expandable elements that might reveal sender info
          const expandButtons = document.querySelectorAll('[aria-label*="Show details"], [aria-label*="details"], .aW3');
          for (const button of expandButtons) {
            try {
              (button as HTMLElement).click();
              console.log('Clicked expand button');
            } catch (e) {
              console.log('Could not click expand button:', e);
            }
          }
        }

        // Additional spam folder specific extraction
        if (!foundSender || from === 'No sender found') {
          console.log('Attempting spam-specific sender extraction...');
          
          // Try to find sender in the message thread header area
          const threadHeaders = document.querySelectorAll('.gE, .adn, .afn');
          for (const header of threadHeaders) {
            // Look for any email patterns in the header area
            const headerText = header.textContent || '';
            const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emailMatches = headerText.match(emailPattern);
            
            if (emailMatches) {
              // Filter out system emails
              const validEmails = emailMatches.filter(email => 
                !email.includes('no-reply@accounts.google.com') &&
                !email.includes('noreply@google.com') &&
                !email.includes('@google.com')
              );
              
              if (validEmails.length > 0) {
                from = validEmails[0];
                console.log(`Spam sender found in header: ${from}`);
                foundSender = true;
                break;
              }
            }
          }
          
          // Final fallback: Look for any mailto links
          if (!foundSender) {
            const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
            for (const link of mailtoLinks) {
              const href = link.getAttribute('href');
              if (href) {
                const email = href.replace('mailto:', '').split('?')[0];
                if (email && !email.includes('no-reply@accounts.google.com')) {
                  from = email;
                  console.log(`Sender found in mailto link: ${from}`);
                  foundSender = true;
                  break;
                }
              }
            }
          }
          
          // Super aggressive fallback for spam: Try to find any email in the entire page content
          if (!foundSender) {
            console.log('Performing aggressive email search in page content...');
            const pageText = document.body.textContent || '';
            const allEmailMatches = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
            
            if (allEmailMatches) {
              console.log('Found emails in page:', allEmailMatches);
              
              // Filter out system emails and common false positives
              const filteredEmails = allEmailMatches.filter(email => {
                const lowerEmail = email.toLowerCase();
                return !lowerEmail.includes('no-reply@accounts.google.com') &&
                       !lowerEmail.includes('noreply@google.com') &&
                       !lowerEmail.includes('@google.com') &&
                       !lowerEmail.includes('@googlemail.com') &&
                       !lowerEmail.includes('example@') &&
                       !lowerEmail.includes('test@') &&
                       !lowerEmail.includes('admin@localhost') &&
                       lowerEmail.length > 5; // Basic validation
              });
              
              if (filteredEmails.length > 0) {
                // Take the first valid email (most likely to be the sender)
                from = filteredEmails[0];
                console.log(`Aggressive search found sender: ${from}`);
              }
            }
          }
        }

        // Get the email content - comprehensive selectors for Gmail content
        let content = 'No content found';
        
        const contentSelectors = [
          // Primary Gmail content selectors
          '.ii.gt .a3s.aiL',
          '.ii.gt div[dir="ltr"]',
          '.a3s.aiL',
          // Message content variations
          '[role="listitem"] .a3s.aiL',
          '.Am .ii .a3s',
          '.message-content .a3s',
          // Alternative content selectors
          '.email-body',
          '.message-body',
          'div[data-message-id] .a3s',
          // Broader content selectors
          '.ii.gt',
          '[role="listitem"] div[dir="ltr"]',
          // Fallback selectors
          '.conversation-content',
          '.thread-content'
        ];

        for (const selector of contentSelectors) {
          const contentElement = document.querySelector(selector);
          if (contentElement && contentElement.textContent?.trim()) {
            content = contentElement.textContent.trim();
            console.log(`Content found with selector: ${selector} -> "${content.substring(0, 100)}..."`);
            break;
          }
        }

        // If still no content, try to get any text from the email thread
        if (content === 'No content found') {
          const threadElement = document.querySelector('[role="main"]');
          if (threadElement) {
            // Remove navigation and header elements
            const clone = threadElement.cloneNode(true) as HTMLElement;
            const elementsToRemove = clone.querySelectorAll('nav, header, .aic, .ar, .ams, button, .nH');
            elementsToRemove.forEach(el => el.remove());
            content = clone.textContent?.trim() || 'No content found';
          }
        }

        const result = {
          subject,
          from,
          content: content // Return full content without length limitation
        };

        console.log('=== Gmail Extraction Complete ===');
        console.log('Final result:', result);
        console.log('Subject found:', subject !== 'No subject found');
        console.log('Sender found:', from !== 'No sender found');
        console.log('Content found:', content !== 'No content found');
        console.log('Is spam folder:', window.location.href.includes('/spam'));
        console.log('================================');
        return result;
      } catch (error) {
        console.error('Error extracting Gmail data:', error);
        return null;
      }
    }

    // Function to extract website data including screenshot
    async function extractWebsiteData(): Promise<WebsiteData | null> {
      try {
        console.log('Starting website data extraction...');
        
        // Get basic page information
        const url = window.location.href;
        const title = document.title || 'No title';
        const domain = window.location.hostname;
        
        // Extract metadata
        const metadata: WebsiteData['metadata'] = {
          domain: domain,
        };
        
        // Get meta description
        const descriptionMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
        if (descriptionMeta?.content) {
          metadata.description = descriptionMeta.content;
        }
        
        // Get meta keywords
        const keywordsMeta = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
        if (keywordsMeta?.content) {
          metadata.keywords = keywordsMeta.content;
        }
        
        // Get meta author
        const authorMeta = document.querySelector('meta[name="author"]') as HTMLMetaElement;
        if (authorMeta?.content) {
          metadata.author = authorMeta.content;
        }
        
        // Get favicon
        const faviconLink = document.querySelector('link[rel*="icon"]') as HTMLLinkElement;
        if (faviconLink?.href) {
          metadata.favicon = faviconLink.href;
        }
        
        // Take screenshot using chrome.tabs.captureVisibleTab
        let screenshot = '';
        try {
          // Request screenshot from background script
          screenshot = await new Promise((resolve, reject) => {
            browser.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
              if (browser.runtime.lastError) {
                reject(browser.runtime.lastError);
              } else {
                resolve(response?.screenshot || '');
              }
            });
          });
        } catch (error) {
          console.warn('Could not capture screenshot:', error);
          screenshot = '';
        }
        
        const result: WebsiteData = {
          url,
          title,
          screenshot,
          metadata
        };
        
        console.log('=== Website Extraction Complete ===');
        console.log('Final result:', {
          ...result,
          screenshot: screenshot ? `[Screenshot captured: ${screenshot.length} chars]` : '[No screenshot]'
        });
        console.log('URL:', url);
        console.log('Title:', title);
        console.log('Domain:', domain);
        console.log('Metadata:', metadata);
        console.log('================================');
        
        return result;
      } catch (error) {
        console.error('Error extracting website data:', error);
        return null;
      }
    }

    // Function to start Facebook post data extraction with state management
    async function startFacebookPostExtraction(): Promise<void> {
      try {
        console.log('Starting Facebook post data extraction...');
        
        // Check if we're on Facebook
        if (!window.location.hostname.includes('facebook.com')) {
          console.error('Not on Facebook domain');
          return;
        }

        // Set extraction state
        facebookExtractionState.inProgress = true;
        facebookExtractionState.data = null;
        facebookExtractionState.startTime = Date.now();

        // Create overlay for post selection
        const overlay = createPostSelectionOverlay();
        document.body.appendChild(overlay);

        // Set up the extraction process
        setupFacebookPostSelection(overlay);
        
      } catch (error) {
        console.error('Error starting Facebook post data extraction:', error);
        facebookExtractionState.inProgress = false;
      }
    }

    // Function to set up Facebook post selection
    function setupFacebookPostSelection(overlay: HTMLDivElement): void {
      // Find all Facebook posts on the page
      const posts = findFacebookPosts();
      console.log(`Found ${posts.length} Facebook posts`);

      if (posts.length === 0) {
        overlay.remove();
        // Remove instructions if they exist
        const instructions = document.querySelector('[style*="transform: translate(-50%, -50%)"]');
        if (instructions) instructions.remove();
        facebookExtractionState.inProgress = false;
        return;
      }

      // Add click handlers to posts for selection
      console.log('Adding selectors to', posts.length, 'posts');
      posts.forEach((post, index) => {
        const postElement = post.element;
        console.log(`Adding selector to post ${index + 1}:`, postElement);
            
            // Create selection indicator
            const indicator = document.createElement('div');
            indicator.className = 'maiscam-post-selector';
            indicator.style.cssText = `
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(59, 130, 246, 0.1);
              border: 3px solid #3b82f6;
              border-radius: 8px;
              cursor: pointer;
              z-index: 10000;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              pointer-events: auto;
            `;
            
            const badge = document.createElement('div');
            badge.style.cssText = `
              background: #3b82f6;
              color: white;
              padding: 8px 16px;
              border-radius: 20px;
              font-weight: bold;
              font-size: 14px;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            `;
            badge.textContent = `📱 Select Post ${index + 1}`;
            indicator.appendChild(badge);

            // Position indicator relative to post
            postElement.style.position = 'relative';
            postElement.appendChild(indicator);

        // Add click handler
        indicator.onclick = (e) => {
          console.log('Post selector clicked!', index + 1);
          e.preventDefault();
          e.stopPropagation();
          
          // Remove all indicators and overlays
          document.querySelectorAll('.maiscam-post-selector').forEach(el => el.remove());
          overlay.remove();
          // Remove instructions
          const instructions = document.querySelector('[style*="transform: translate(-50%, -50%)"]');
          if (instructions) instructions.remove();
          // Remove cancel button if it exists
          const cancelBtn = document.querySelector('[style*="position: fixed"][style*="top: 20px"][style*="right: 20px"]');
          if (cancelBtn) cancelBtn.remove();
          
          // Extract data from selected post and update state
          const extractedData = extractPostData(post);
          facebookExtractionState.data = extractedData;
          facebookExtractionState.inProgress = false;
          
          console.log('Facebook extraction completed:', extractedData);
          
          // Show success notification to user
          showPostSelectionSuccess();
        };

        // Add hover effects
        indicator.onmouseenter = () => {
          indicator.style.background = 'rgba(59, 130, 246, 0.2)';
          badge.style.background = '#2563eb';
        };
        indicator.onmouseleave = () => {
          indicator.style.background = 'rgba(59, 130, 246, 0.1)';
          badge.style.background = '#3b82f6';
        };
      });

      // Add cancel button to overlay
      const cancelButton = document.createElement('button');
      cancelButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
        z-index: 10002;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        pointer-events: auto;
      `;
      cancelButton.textContent = '✕ Cancel';
      cancelButton.onclick = () => {
        document.querySelectorAll('.maiscam-post-selector').forEach(el => el.remove());
        overlay.remove();
        // Remove instructions
        const instructions = document.querySelector('[style*="transform: translate(-50%, -50%)"]');
        if (instructions) instructions.remove();
        cancelButton.remove();
        
        // Update state
        facebookExtractionState.inProgress = false;
        facebookExtractionState.data = null;
      };
      document.body.appendChild(cancelButton);

      // Auto-remove after 60 seconds
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.querySelectorAll('.maiscam-post-selector').forEach(el => el.remove());
          overlay.remove();
          // Remove instructions
          const instructions = document.querySelector('[style*="transform: translate(-50%, -50%)"]');
          if (instructions) instructions.remove();
          if (document.body.contains(cancelButton)) {
            cancelButton.remove();
          }
          
          // Update state - timed out
          facebookExtractionState.inProgress = false;
          facebookExtractionState.data = null;
        }
      }, 60000);
    }

    // Function to show success notification after post selection
    function showPostSelectionSuccess(): void {
      // Remove any existing success notifications
      const existingNotification = document.getElementById('maiscam-success-notification');
      if (existingNotification) {
        existingNotification.remove();
      }

      // Create success notification
      const notification = document.createElement('div');
      notification.id = 'maiscam-success-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #10b981;
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.3);
        z-index: 10003;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center;
        max-width: 400px;
        animation: slideDown 0.5s ease-out;
      `;
      
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <span style="font-size: 20px;">✅</span>
          <span style="font-weight: bold; font-size: 16px;">Post Selected Successfully!</span>
        </div>
        <p style="margin: 0; font-size: 14px; opacity: 0.9;">
          Facebook post data has been extracted.<br/>
          <strong>Please reopen the extension popup to view the results!</strong>
        </p>
      `;

      // Add CSS animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideDown {
          from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);

      document.body.appendChild(notification);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.style.animation = 'slideDown 0.5s ease-out reverse';
          setTimeout(() => notification.remove(), 500);
        }
      }, 10000);

      // Also remove when clicked
      notification.onclick = () => {
        notification.style.animation = 'slideDown 0.5s ease-out reverse';
        setTimeout(() => notification.remove(), 500);
      };
    }

    // Function to create post selection overlay
    function createPostSelectionOverlay(): HTMLDivElement {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.3);
        z-index: 9998;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      const instructions = document.createElement('div');
      instructions.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 24px;
        border-radius: 12px;
        text-align: center;
        max-width: 400px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        pointer-events: none;
        z-index: 10001;
      `;
      instructions.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: bold;">
          📱 Select a Facebook Post
        </h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
          Click on any post with an image to extract its data.<br/>
          Posts with videos will be skipped automatically.
        </p>
      `;
      
      document.body.appendChild(instructions);
      return overlay;
    }

    // Function to find Facebook posts on the page
    function findFacebookPosts(): Array<{element: HTMLElement, hasImage: boolean, hasVideo: boolean}> {
      const posts: Array<{element: HTMLElement, hasImage: boolean, hasVideo: boolean}> = [];
      
      // Multiple selectors for different Facebook layouts and post types
      const postSelectors = [
        // Main feed posts
        '[data-pagelet="FeedUnit_0"], [data-pagelet="FeedUnit_1"], [data-pagelet="FeedUnit_2"]',
        '[data-pagelet*="FeedUnit"]',
        // Individual posts
        '[role="article"]',
        '[data-ft*="top_level_post_id"]',
        // Story/post containers
        '.userContentWrapper',
        '._5pcr',
        // New Facebook layout
        '[data-ad-preview="message"]',
        '.x1yztbdb', // Common post container class
        // Profile posts
        '[data-testid="post_message"]',
        // Group posts
        '.du4w35lb',
        // Alternative selectors
        '.story_body_container',
        '._427x'
      ];

      for (const selector of postSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => {
            // Check if this post has an image (skip videos)
            const hasImage = element.querySelector('img[src*="scontent"], img[src*="fbcdn"], .scaledImageFitWidth, [data-testid="post-image"]');
            const hasVideo = element.querySelector('video, [data-testid="post-video"], .videoContainer');
            
            if (hasImage && !hasVideo && !posts.find(p => p.element === element)) {
              posts.push({
                element: element as HTMLElement,
                hasImage: true,
                hasVideo: false
              });
            }
          });
        } catch (e) {
          console.log(`Selector ${selector} failed:`, e);
        }
      }

      // Filter out posts that are too small (likely ads or other content)
      return posts.filter(post => {
        const rect = post.element.getBoundingClientRect();
        return rect.height > 100 && rect.width > 200;
      });
    }

    // Function to extract data from a selected Facebook post
    function extractPostData(post: {element: HTMLElement, hasImage: boolean, hasVideo: boolean}): FacebookPostData | null {
      try {
        const postElement = post.element;
        console.log('Extracting data from selected post:', postElement);

        // Extract username - the person who posted this
        let username = 'Unknown User';
        console.log('=== Starting username extraction ===');
        console.log('Post element:', postElement);
        console.log('Post element HTML:', postElement.outerHTML.substring(0, 500) + '...');
        const usernameSelectors = [
          // Modern Facebook selectors (most reliable)
          '[data-testid="post-author-name"]',
          '[data-testid="post-author-name"] span',
          'h3 a[role="link"]',
          'h3 span > span',
          'strong a[role="link"]',
          
          // Profile link selectors
          'a[data-hovercard-id]',
          'a[data-hovercard-id] span',
          '.profileLink',
          '.profileLink span',
          
          // Author selectors
          '.actor a',
          '.actor a span',
          '.author a',
          '.author a span',
          
          // Header selectors
          'h4 a',
          'h3 strong',
          'h2 a',
          
          // Alternative selectors
          '[data-testid="story-subtitle"] a',
          '.story-subtitle a',
          '.post-header a',
          '.post-header span',
          
          // Broader selectors for different layouts
          'a[href*="/profile.php"]',
          'a[href*="/profile.php"] span',
          'a[href*="/permalink/"]',
          'a[href*="/permalink/"] span',
          
          // Fallback selectors
          '.x1yztbdb a[role="link"]',
          '.x1yztbdb span[dir="auto"]',
          '[role="article"] h3 a',
          '[role="article"] h3 span'
        ];

        for (const selector of usernameSelectors) {
          const element = postElement.querySelector(selector);
          console.log(`Trying selector: ${selector} -> Found:`, element);
          if (element && element.textContent?.trim()) {
            const text = element.textContent.trim();
            console.log(`Selector ${selector} text content: "${text}"`);
            // Filter out very short or invalid usernames
            if (text.length > 1 && text.length < 100 && 
                !text.includes('•') && !text.includes('·') && 
                !text.match(/^\d+$/) && !text.includes('@')) {
              username = text;
              console.log(`✅ Username found with selector: ${selector} -> "${username}"`);
              break;
            } else {
              console.log(`❌ Username filtered out: "${text}" (length: ${text.length}, contains invalid chars)`);
            }
          } else {
            console.log(`❌ Selector ${selector} found no element or empty text`);
          }
        }

        // If still no username, try to find it in the post header area
        if (username === 'Unknown User') {
          console.log('Trying alternative username extraction methods...');
          
          // Look for any clickable profile links in the post header
          const headerArea = postElement.querySelector('[role="article"], .userContentWrapper, ._5pcr, .x1yztbdb');
          if (headerArea) {
            const profileLinks = headerArea.querySelectorAll('a[href*="/profile.php"], a[href*="/permalink/"], a[data-hovercard-id]');
            for (const link of profileLinks) {
              const linkText = link.textContent?.trim();
              if (linkText && linkText.length > 1 && linkText.length < 100 && 
                  !linkText.includes('•') && !linkText.includes('·') && 
                  !linkText.match(/^\d+$/) && !linkText.includes('@')) {
                username = linkText;
                console.log(`Username found in profile link: "${username}"`);
                break;
              }
            }
          }
        }

        // Extract caption/post text
        let caption = 'No caption found';
        const captionSelectors = [
          // Main post text
          '[data-testid="post_message"] span',
          '[data-testid="post_message"]',
          '.userContent',
          '.text_exposed_root',
          // Alternative text selectors
          '[data-ad-preview="message"]',
          '.story_body_container',
          '._5pbx',
          // Broader selectors
          'div[dir="auto"]',
          '.x11i5rnm span',
          'div[data-ad-comet-preview="message"]'
        ];

        for (const selector of captionSelectors) {
          const element = postElement.querySelector(selector);
          if (element && element.textContent?.trim()) {
            const text = element.textContent.trim();
            // Filter out very short text that might be UI elements
            if (text.length > 10) {
              caption = text;
              console.log(`Caption found with selector: ${selector} -> "${caption.substring(0, 100)}..."`);
              break;
            }
          }
        }

        // Extract image URL
        let image = undefined;
        const imageSelectors = [
          'img[src*="scontent"]',
          'img[src*="fbcdn"]',
          '.scaledImageFitWidth img',
          '[data-testid="post-image"] img',
          // Alternative image selectors
          '.spotlight img',
          '._46-i img',
          '.uiScaledImageContainer img',
          // Broader selectors
          'img[alt]:not([src*="emoji"])'
        ];

        for (const selector of imageSelectors) {
          const imgElement = postElement.querySelector(selector) as HTMLImageElement;
          if (imgElement?.src && imgElement.src.startsWith('http')) {
            // Skip very small images (likely profile pics or icons)
            if (imgElement.naturalWidth > 200 || imgElement.width > 200) {
              image = imgElement.src;
              console.log(`Image found with selector: ${selector} -> ${image}`);
              break;
            }
          }
        }

        // Extract timestamp
        let timestamp = undefined;
        const timestampSelectors = [
          'abbr[data-utime]',
          '[data-testid="story-subtitle"] a',
          '.timestampContent',
          '._5ptz',
          // Alternative timestamp selectors
          'time',
          '[title*="20"]', // Years
          'a[href*="/posts/"]'
        ];

        for (const selector of timestampSelectors) {
          const element = postElement.querySelector(selector);
          if (element) {
            const timeText = element.textContent?.trim() || element.getAttribute('title') || element.getAttribute('data-utime');
            if (timeText) {
              timestamp = timeText;
              console.log(`Timestamp found with selector: ${selector} -> "${timestamp}"`);
              break;
            }
          }
        }

        // Generate post URL
        let postUrl = window.location.href;
        
        // Try to find a more specific post URL
        const linkSelectors = [
          'a[href*="/posts/"]',
          'a[href*="/photo/"]',
          'a[href*="/permalink/"]',
          '[data-testid="story-subtitle"] a'
        ];

        for (const selector of linkSelectors) {
          const linkElement = postElement.querySelector(selector) as HTMLAnchorElement;
          if (linkElement?.href) {
            postUrl = linkElement.href;
            break;
          }
        }

        const result: FacebookPostData = {
          username,
          caption,
          image,
          postUrl,
          timestamp
        };

        console.log('=== Facebook Post Extraction Complete ===');
        console.log('Final result:', result);
        console.log('Username found:', username !== 'Unknown User');
        console.log('Caption found:', caption !== 'No caption found');
        console.log('Image found:', !!image);
        console.log('Timestamp found:', !!timestamp);
        console.log('============================================');

        return result;
      } catch (error) {
        console.error('Error extracting post data:', error);
        return null;
      }
    }

    // Function to create and show analysis modal on Gmail page
    function showAnalysisModal(result: any, loading: boolean = false) {
      // Remove existing modal if any
      const existingModal = document.getElementById('maiscam-analysis-modal');
      if (existingModal) {
        existingModal.remove();
      }

      // Create modal container
      const modalContainer = document.createElement('div');
      modalContainer.id = 'maiscam-analysis-modal';
      modalContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      // Create modal content
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        border-radius: 8px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        max-width: 400px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
      `;

      // Modal header
      const header = document.createElement('div');
      header.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid #e5e7eb;
      `;

      const headerLeft = document.createElement('div');
      headerLeft.style.cssText = 'display: flex; align-items: center; gap: 8px;';
      
      const icon = document.createElement('div');
      icon.style.cssText = `
        width: 24px;
        height: 24px;
        background-color: #ef4444;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: bold;
      `;
      icon.textContent = '🛡️';

      const title = document.createElement('h3');
      title.style.cssText = 'font-size: 18px; font-weight: 600; color: #111827; margin: 0;';
      title.textContent = 'mAIscam Active';

      headerLeft.appendChild(icon);
      headerLeft.appendChild(title);

      const closeButton = document.createElement('button');
      closeButton.style.cssText = `
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        font-size: 24px;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      closeButton.innerHTML = '×';
      closeButton.onclick = () => modalContainer.remove();

      header.appendChild(headerLeft);
      header.appendChild(closeButton);

      // Modal body
      const body = document.createElement('div');
      body.style.cssText = 'padding: 24px;';

      if (loading) {
        // Loading state
        const loadingDiv = document.createElement('div');
        loadingDiv.style.cssText = 'text-align: center; padding: 32px 0;';
        
        const spinner = document.createElement('div');
        spinner.style.cssText = `
          width: 48px;
          height: 48px;
          border: 2px solid #e5e7eb;
          border-top: 2px solid #ef4444;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        `;
        
        const loadingText = document.createElement('p');
        loadingText.style.cssText = 'color: #6b7280; margin: 0;';
        loadingText.textContent = 'Analyzing email...';
        
        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(loadingText);
        body.appendChild(loadingDiv);
      } else if (result) {
        // Analysis result
        const getRiskColor = (riskLevel: string) => {
          const level = riskLevel.toLowerCase();
          if (level === 'high' || level === '高') return '#ef4444';
          if (level === 'medium' || level === '中') return '#f59e0b';
          return '#10b981';
        };

        const getRiskBg = (riskLevel: string) => {
          const level = riskLevel.toLowerCase();
          if (level === 'high' || level === '高') return '#fef2f2';
          if (level === 'medium' || level === '中') return '#fffbeb';
          return '#f0fdf4';
        };

        const getRiskBorder = (riskLevel: string) => {
          const level = riskLevel.toLowerCase();
          if (level === 'high' || level === '高') return '#fecaca';
          if (level === 'medium' || level === '中') return '#fed7aa';
          return '#bbf7d0';
        };

        // Risk level badge
        const riskContainer = document.createElement('div');
        riskContainer.style.cssText = 'text-align: center; margin-bottom: 24px;';
        
        const riskBadge = document.createElement('div');
        riskBadge.style.cssText = `
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          border-radius: 9999px;
          color: white;
          font-weight: 600;
          background-color: ${getRiskColor(result.risk_level)};
          margin-bottom: 8px;
        `;
        riskBadge.innerHTML = `<span style="margin-right: 8px;">⚠️</span>${result.risk_level.toUpperCase()} RISK`;
        
        const percentage = document.createElement('div');
        percentage.style.cssText = 'font-size: 18px; font-weight: bold; color: #111827;';
        percentage.textContent = result.risk_level === '高' || result.risk_level.toLowerCase() === 'high' ? '79%' : 
                                result.risk_level === '中' || result.risk_level.toLowerCase() === 'medium' ? '45%' : '15%';
        
        riskContainer.appendChild(riskBadge);
        riskContainer.appendChild(percentage);

        // Analysis section
        const analysisBox = document.createElement('div');
        analysisBox.style.cssText = `
          padding: 16px;
          border-radius: 8px;
          border: 1px solid ${getRiskBorder(result.risk_level)};
          background-color: ${getRiskBg(result.risk_level)};
          margin-bottom: 16px;
        `;
        
        const analysisTitle = document.createElement('h4');
        analysisTitle.style.cssText = `
          font-weight: 600;
          color: ${getRiskColor(result.risk_level)};
          margin: 0 0 8px 0;
          font-size: 14px;
        `;
        analysisTitle.textContent = '📊 Analysis';
        
        const analysisText = document.createElement('p');
        analysisText.style.cssText = 'color: #374151; font-size: 14px; line-height: 1.5; margin: 0;';
        analysisText.textContent = result.analysis;
        
        analysisBox.appendChild(analysisTitle);
        analysisBox.appendChild(analysisText);

        // Recommended action section
        const actionBox = document.createElement('div');
        actionBox.style.cssText = `
          padding: 16px;
          border-radius: 8px;
          border: 1px solid ${getRiskBorder(result.risk_level)};
          background-color: ${getRiskBg(result.risk_level)};
          margin-bottom: 16px;
        `;
        
        const actionTitle = document.createElement('h4');
        actionTitle.style.cssText = `
          font-weight: 600;
          color: ${getRiskColor(result.risk_level)};
          margin: 0 0 8px 0;
          font-size: 14px;
        `;
        actionTitle.textContent = '💡 Recommended Action';
        
        const actionText = document.createElement('p');
        actionText.style.cssText = 'color: #374151; font-size: 14px; line-height: 1.5; margin: 0;';
        actionText.textContent = result.recommended_action;
        
        actionBox.appendChild(actionTitle);
        actionBox.appendChild(actionText);

        // Action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 12px; padding-top: 16px;';
        
        const reportButton = document.createElement('button');
        reportButton.style.cssText = `
          flex: 1;
          background-color: #ef4444;
          color: white;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: background-color 0.2s;
        `;
        reportButton.textContent = 'REPORT FRAUD';
        reportButton.onmouseover = () => reportButton.style.backgroundColor = '#dc2626';
        reportButton.onmouseout = () => reportButton.style.backgroundColor = '#ef4444';
        
        const dismissButton = document.createElement('button');
        dismissButton.style.cssText = `
          flex: 1;
          background-color: #e5e7eb;
          color: #374151;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: background-color 0.2s;
        `;
        dismissButton.textContent = 'DISMISS';
        dismissButton.onclick = () => modalContainer.remove();
        dismissButton.onmouseover = () => dismissButton.style.backgroundColor = '#d1d5db';
        dismissButton.onmouseout = () => dismissButton.style.backgroundColor = '#e5e7eb';
        
        buttonContainer.appendChild(reportButton);
        buttonContainer.appendChild(dismissButton);

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = `
          text-align: center;
          font-size: 12px;
          color: #6b7280;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          margin-top: 16px;
        `;
        footer.textContent = 'Full analysis shown in email.';

        body.appendChild(riskContainer);
        body.appendChild(analysisBox);
        body.appendChild(actionBox);
        body.appendChild(buttonContainer);
        body.appendChild(footer);
      }

      // Add CSS animation for spinner
      if (loading) {
        const style = document.createElement('style');
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }

      modal.appendChild(header);
      modal.appendChild(body);
      modalContainer.appendChild(modal);
      
      // Close modal when clicking backdrop
      modalContainer.onclick = (e) => {
        if (e.target === modalContainer) {
          modalContainer.remove();
        }
      };

      document.body.appendChild(modalContainer);
    }

    // Function to analyze email and show modal
    async function analyzeCurrentEmail(targetLanguage: string = 'zh') {
      const gmailData = extractGmailData();
      if (!gmailData) {
        console.error('No Gmail data available for analysis');
        return;
      }

      // Log extracted email data in JSON format
      const emailJson = {
        title: gmailData.subject,
        content: gmailData.content,
        from_email: gmailData.from,
        target_language: targetLanguage
      };
      console.log('📧 Extracted Email Data JSON:', JSON.stringify(emailJson, null, 2));

      // Show loading modal
      showAnalysisModal(null, true);

      try {
        const request: AnalysisRequest = {
          title: gmailData.subject,
          content: gmailData.content,
          from_email: gmailData.from,
          target_language: targetLanguage
        };

        const response: AnalysisResponse = await analyzeEmail(request);
        console.log('🔍 API Analysis Response:', JSON.stringify(response, null, 2));
        
        if (response.success && response.data[targetLanguage]) {
          // Show result modal
          showAnalysisModal(response.data[targetLanguage], false);
        } else {
          console.error('Failed to analyze email');
          document.getElementById('maiscam-analysis-modal')?.remove();
        }
      } catch (err) {
        console.error('Error analyzing email:', err);
        document.getElementById('maiscam-analysis-modal')?.remove();
      }
    }

    // Listen for messages from popup requesting data
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_GMAIL_DATA') {
        const gmailData = extractGmailData();
        console.log('Manual Gmail data extraction requested:', gmailData);
        sendResponse(gmailData);
      } else if (message.type === 'ANALYZE_EMAIL') {
        analyzeCurrentEmail(message.targetLanguage || 'zh');
        sendResponse({ success: true });
      } else if (message.type === 'GET_WEBSITE_DATA') {
        console.log('Website data extraction requested');
        extractWebsiteData().then((websiteData) => {
          console.log('Website data extraction result:', websiteData);
          sendResponse(websiteData);
        }).catch((error) => {
          console.error('Error in website data extraction:', error);
          sendResponse(null);
        });
        return true; // Indicates we will send a response asynchronously
      } else if (message.type === 'START_FACEBOOK_EXTRACTION') {
        console.log('Starting Facebook post data extraction');
        startFacebookPostExtraction().then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          console.error('Error starting Facebook data extraction:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true; // Indicates we will send a response asynchronously
      } else if (message.type === 'CHECK_FACEBOOK_EXTRACTION_STATUS') {
        console.log('Checking Facebook extraction status');
        sendResponse({
          inProgress: facebookExtractionState.inProgress,
          data: facebookExtractionState.data,
          startTime: facebookExtractionState.startTime
        });
      } else if (message.type === 'GET_FACEBOOK_DATA') {
        console.log('Legacy Facebook post data extraction requested');
        // For backward compatibility, start extraction if not already in progress
        if (!facebookExtractionState.inProgress) {
          startFacebookPostExtraction().then(() => {
            sendResponse(facebookExtractionState.data);
          }).catch((error) => {
            console.error('Error in Facebook data extraction:', error);
            sendResponse(null);
          });
          return true;
        } else {
          // Return current state
          sendResponse(facebookExtractionState.data);
        }
      }
    });

    console.log('Content script initialized for:', window.location.hostname);
  },
});
