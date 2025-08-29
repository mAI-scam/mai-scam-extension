
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
      replyTo: string;
    }

    // Interface for Website data
    interface WebsiteData {
      url: string;
      title: string;
      content: string;
      metadata: {
        description?: string;
        keywords?: string;
        author?: string;
        domain: string;
        favicon?: string;
        ssl?: {
          isSecure: boolean;
          protocol: string;
        };
        security?: {
          hasCSP?: boolean;
          hasXFrameOptions?: boolean;
          hasHSTS?: boolean;
          hasXSSProtection?: boolean;
        };
        seo?: {
          canonical?: string;
          robots?: string;
          viewport?: string;
        };
        social?: {
          ogTitle?: string;
          ogDescription?: string;
          ogImage?: string;
          ogUrl?: string;
          twitterCard?: string;
        };
        technical?: {
          charset?: string;
          generator?: string;
          language?: string;
          httpEquiv?: string[];
        };
        links?: {
          externalLinksCount: number;
          suspiciousLinks: string[];
          socialMediaLinks: string[];
        };
      };
    }

    // Interface for Facebook post data
    interface FacebookPostData {
      username: string;
      caption: string;
      image?: string;
      postUrl: string;
      timestamp?: string;
      author_followers_count?: number;
      engagement_metrics?: {
        likes?: number;
        comments?: number;
        shares?: number;
        reactions?: number;
      };
    }

    // Function to extract Gmail data
    async function extractGmailData(): Promise<GmailData | null> {
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

        // Also try to expand any collapsed email headers that might contain reply-to
        console.log('Attempting to expand email headers for reply-to...');
        const headerExpandButtons = document.querySelectorAll('[aria-label*="Show details"], [aria-label*="details"], [aria-label*="header"], .aW3, [class*="expand"], [class*="toggle"]');
        for (const button of headerExpandButtons) {
          try {
            (button as HTMLElement).click();
            console.log('Clicked header expand button:', button);
            // Wait a bit for content to load
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (e) {
            console.log('Could not click header expand button:', e);
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

        // Extract reply-to information
        let replyTo = 'None';
        console.log('Starting reply-to extraction...');
        
        // Debug: Log page structure to help understand where reply-to might be
        console.log('Page URL:', window.location.href);
        console.log('Page title:', document.title);
        
        // Look for any visible text containing "reply-to" for debugging
        const pageText = document.body.textContent || '';
        if (pageText.toLowerCase().includes('reply-to')) {
          console.log('Found "reply-to" text in page content');
          const replyToIndex = pageText.toLowerCase().indexOf('reply-to');
          const context = pageText.substring(Math.max(0, replyToIndex - 50), replyToIndex + 100);
          console.log('Reply-to context:', context);
        } else {
          console.log('No "reply-to" text found in page content');
        }
        const replyToSelectors = [
          // Look for reply-to headers in email content
          '.adn .afn', // Raw headers in expanded view
          '.afn .g2', // Raw sender info
          // Look for reply-to patterns in the content
          '[data-legacy-message-id] .a3s',
          '.ii.gt .a3s.aiL',
          // Alternative selectors for reply-to
          '.message-headers',
          '.email-headers',
          // Gmail specific selectors
          '.adn .afn .g2',
          '.afn .g2[email]',
          // Raw email headers
          '.adn',
          '.afn',
          // Additional Gmail header selectors
          '.adn .afn div',
          '.afn div',
          '.adn div',
          // Try to find any element containing reply-to text
          '*[class*="header"]',
          '*[class*="meta"]'
        ];

        // Try to find reply-to information in headers first
        for (const selector of replyToSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const text = element.textContent;
            console.log(`Searching for reply-to in selector ${selector}:`, text.substring(0, 200) + '...');
            
            // Look for reply-to patterns in headers - handle both colon and tab separators
            const replyToPatterns = [
              /reply-to:\s*([^\r\n]+)/i,           // reply-to: value
              /reply-to\t+([^\r\n]+)/i,            // reply-to\tvalue (tab separator)
              /reply-to\s+([^\r\n]+)/i,            // reply-to value (space separator)
              /reply-to\s*=\s*([^\r\n]+)/i        // reply-to = value
            ];
            
            for (const pattern of replyToPatterns) {
              const replyToMatch = text.match(pattern);
              if (replyToMatch && replyToMatch[1]) {
                let replyToValue = replyToMatch[1].trim();
                console.log(`Raw reply-to match: "${replyToValue}"`);
                
                // Handle quoted format: "Name" <email@domain.com>
                if (replyToValue.includes('<') && replyToValue.includes('>')) {
                  const emailMatch = replyToValue.match(/<([^>]+)>/);
                  if (emailMatch && emailMatch[1]) {
                    replyToValue = emailMatch[1].trim();
                    console.log(`Extracted email from quoted format: "${replyToValue}"`);
                  }
                }
                
                // Handle just the email part if it's mixed with other text
                if (replyToValue.includes('@')) {
                  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
                  const emailMatch = replyToValue.match(emailPattern);
                  if (emailMatch) {
                    replyToValue = emailMatch[0];
                    console.log(`Extracted clean email: "${replyToValue}"`);
                  }
                }
                
                if (replyToValue.includes('@') && replyToValue.length > 5) {
                  replyTo = replyToValue;
                  console.log(`Reply-to found in headers with selector: ${selector} -> "${replyTo}"`);
                  break;
                }
              }
            }
            
            if (replyTo !== 'None') break;
          }
        }
        
        // If still no reply-to found, try a more aggressive search across the entire page
        if (replyTo === 'None') {
          console.log('Performing aggressive reply-to search across entire page...');
          
          // Look for any text containing "reply-to" anywhere on the page
          const allElements = document.querySelectorAll('*');
          for (const element of allElements) {
            if (element.textContent && element.textContent.toLowerCase().includes('reply-to')) {
              const text = element.textContent;
              console.log(`Found element with reply-to text:`, element.tagName, element.className, text.substring(0, 100) + '...');
              
              // Try to extract reply-to value from this text
              const replyToPatterns = [
                /reply-to:\s*([^\r\n]+)/i,
                /reply-to\t+([^\r\n]+)/i,
                /reply-to\s+([^\r\n]+)/i,
                /reply-to\s*=\s*([^\r\n]+)/i
              ];
              
              for (const pattern of replyToPatterns) {
                const replyToMatch = text.match(pattern);
                if (replyToMatch && replyToMatch[1]) {
                  let replyToValue = replyToMatch[1].trim();
                  console.log(`Raw reply-to match from aggressive search: "${replyToValue}"`);
                  
                  // Handle quoted format: "Name" <email@domain.com>
                  if (replyToValue.includes('<') && replyToValue.includes('>')) {
                    const emailMatch = replyToValue.match(/<([^>]+)>/);
                    if (emailMatch && emailMatch[1]) {
                      replyToValue = emailMatch[1].trim();
                      console.log(`Extracted email from quoted format: "${replyToValue}"`);
                    }
                  }
                  
                  // Handle just the email part if it's mixed with other text
                  if (replyToValue.includes('@')) {
                    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
                    const emailMatch = replyToValue.match(emailPattern);
                    if (emailMatch) {
                      replyToValue = emailMatch[0];
                      console.log(`Extracted clean email: "${replyToValue}"`);
                    }
                  }
                  
                  if (replyToValue.includes('@') && replyToValue.length > 5) {
                    replyTo = replyToValue;
                    console.log(`Reply-to found with aggressive search -> "${replyTo}"`);
                    break;
                  }
                }
              }
              
              if (replyTo !== 'None') break;
            }
          }
        }

        // If no reply-to found in headers, try to look for it in the email content
        if (replyTo === 'None') {
          // Look for common reply-to patterns in the email body
          const replyToPatterns = [
            /reply\s*to:\s*([^\r\n]+)/i,
            /reply\s*to\s*email:\s*([^\r\n]+)/i,
            /send\s*reply\s*to:\s*([^\r\n]+)/i,
            /contact\s*us\s*at:\s*([^\r\n]+)/i,
            /email\s*us\s*at:\s*([^\r\n]+)/i,
            /reply\s*to\s*this\s*email\s*at:\s*([^\r\n]+)/i,
            /please\s*reply\s*to:\s*([^\r\n]+)/i,
            /direct\s*replies\s*to:\s*([^\r\n]+)/i,
            /send\s*response\s*to:\s*([^\r\n]+)/i,
            /contact\s*email:\s*([^\r\n]+)/i
          ];

          for (const pattern of replyToPatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
              const potentialReplyTo = match[1].trim();
              // Clean up the email (remove extra punctuation, etc.)
              const cleanEmail = potentialReplyTo.replace(/[^\w@.-]/g, '');
              if (cleanEmail.includes('@') && cleanEmail.length > 5 && 
                  cleanEmail.includes('.') && !cleanEmail.includes('..')) {
                replyTo = cleanEmail;
                console.log(`Reply-to found in content with pattern: ${pattern} -> "${replyTo}"`);
                break;
              }
            }
          }
        }

        // Additional check: Look for any email addresses that might be reply-to candidates
        if (replyTo === 'None') {
          // Extract all email addresses from content and find the most likely reply-to
          const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const allEmails = content.match(emailPattern);
          
          if (allEmails && allEmails.length > 0) {
            // Filter out the sender email and common system emails
            const filteredEmails = allEmails.filter(email => {
              const lowerEmail = email.toLowerCase();
              return email !== from && 
                     !lowerEmail.includes('no-reply@') &&
                     !lowerEmail.includes('noreply@') &&
                     !lowerEmail.includes('donotreply@') &&
                     !lowerEmail.includes('@google.com') &&
                     !lowerEmail.includes('@googlemail.com') &&
                     !lowerEmail.includes('@gmail.com');
            });
            
            if (filteredEmails.length > 0) {
              // Take the first valid email as potential reply-to
              replyTo = filteredEmails[0];
              console.log(`Reply-to found from filtered email list: "${replyTo}"`);
            }
          }
        }

        const result = {
          subject,
          from,
          content: content, // Return full content without length limitation
          replyTo
        };

        console.log('Reply-to extraction summary:', {
          found: replyTo !== 'None',
          value: replyTo,
          method: replyTo !== 'None' ? 'extracted' : 'not found'
        });

        console.log('=== Gmail Extraction Complete ===');
        console.log('Final result:', result);
        console.log('Subject found:', subject !== 'No subject found');
        console.log('Sender found:', from !== 'No sender found');
        console.log('Reply-to found:', replyTo !== 'None', replyTo !== 'None' ? `(${replyTo})` : '');
        console.log('Content found:', content !== 'No content found');
        console.log('Is spam folder:', window.location.href.includes('/spam'));
        console.log('================================');
        return result;
      } catch (error) {
        console.error('Error extracting Gmail data:', error);
        return null;
      }
    }

    // Function to extract website data with enhanced metadata extraction
    async function extractWebsiteData(): Promise<WebsiteData | null> {
      try {
        console.log('Starting enhanced website data extraction...');
        
        // Get basic page information
        const url = window.location.href;
        const title = document.title || 'No title';
        const domain = window.location.hostname;
        
        // Extract enhanced metadata
        const metadata: WebsiteData['metadata'] = {
          domain: domain,
        };
        
        // Basic metadata
        const descriptionMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
        if (descriptionMeta?.content) {
          metadata.description = descriptionMeta.content;
        }
        
        const keywordsMeta = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
        if (keywordsMeta?.content) {
          metadata.keywords = keywordsMeta.content;
        }
        
        const authorMeta = document.querySelector('meta[name="author"]') as HTMLMetaElement;
        if (authorMeta?.content) {
          metadata.author = authorMeta.content;
        }
        
        const faviconLink = document.querySelector('link[rel*="icon"]') as HTMLLinkElement;
        if (faviconLink?.href) {
          metadata.favicon = faviconLink.href;
        }

        // SSL Information
        metadata.ssl = {
          isSecure: window.location.protocol === 'https:',
          protocol: window.location.protocol
        };

        // Security Headers (limited to what we can detect from DOM)
        metadata.security = {
          hasCSP: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
          hasXFrameOptions: !!document.querySelector('meta[http-equiv="X-Frame-Options"]'),
          hasHSTS: !!document.querySelector('meta[http-equiv="Strict-Transport-Security"]'),
          hasXSSProtection: !!document.querySelector('meta[http-equiv="X-XSS-Protection"]')
        };

        // SEO Metadata
        metadata.seo = {};
        
        const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
        if (canonicalLink?.href) {
          metadata.seo.canonical = canonicalLink.href;
        }
        
        const robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
        if (robotsMeta?.content) {
          metadata.seo.robots = robotsMeta.content;
        }
        
        const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
        if (viewportMeta?.content) {
          metadata.seo.viewport = viewportMeta.content;
        }

        // Social Media Metadata (Open Graph, Twitter)
        metadata.social = {};
        
        const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
        if (ogTitle?.content) {
          metadata.social.ogTitle = ogTitle.content;
        }
        
        const ogDescription = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;
        if (ogDescription?.content) {
          metadata.social.ogDescription = ogDescription.content;
        }
        
        const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
        if (ogImage?.content) {
          metadata.social.ogImage = ogImage.content;
        }
        
        const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement;
        if (ogUrl?.content) {
          metadata.social.ogUrl = ogUrl.content;
        }
        
        const twitterCard = document.querySelector('meta[name="twitter:card"]') as HTMLMetaElement;
        if (twitterCard?.content) {
          metadata.social.twitterCard = twitterCard.content;
        }

        // Technical Metadata
        metadata.technical = {};
        
        const charsetMeta = document.querySelector('meta[charset]') as HTMLMetaElement;
        if (charsetMeta?.getAttribute('charset')) {
          metadata.technical.charset = charsetMeta.getAttribute('charset');
        }
        
        const generatorMeta = document.querySelector('meta[name="generator"]') as HTMLMetaElement;
        if (generatorMeta?.content) {
          metadata.technical.generator = generatorMeta.content;
        }
        
        const languageMeta = document.querySelector('meta[name="language"]') as HTMLMetaElement || 
                            document.querySelector('html[lang]') as HTMLHtmlElement;
        if (languageMeta) {
          metadata.technical.language = languageMeta.getAttribute('content') || languageMeta.getAttribute('lang') || undefined;
        }
        
        // Collect all http-equiv meta tags
        const httpEquivMetas = document.querySelectorAll('meta[http-equiv]');
        if (httpEquivMetas.length > 0) {
          metadata.technical.httpEquiv = Array.from(httpEquivMetas).map(meta => 
            `${meta.getAttribute('http-equiv')}: ${meta.getAttribute('content')}`
          ).filter(Boolean);
        }

        // Link Analysis for suspicious activity
        metadata.links = await extractLinkMetadata(domain);
        
        // Extract DOM text content
        let content = '';
        try {
          content = await extractPageContent();
        } catch (error) {
          console.warn('Could not extract page content:', error);
          content = 'Content extraction failed';
        }
        
        const result: WebsiteData = {
          url,
          title,
          content,
          metadata
        };
        
        console.log('=== Enhanced Website Extraction Complete ===');
        console.log('Final result:', {
          ...result,
          content: content ? `[Content extracted: ${content.length} chars] ${content.substring(0, 100)}...` : '[No content]'
        });
        console.log('URL:', url);
        console.log('Title:', title);
        console.log('Domain:', domain);
        console.log('Enhanced Metadata:', metadata);
        console.log('SSL Info:', metadata.ssl);
        console.log('Security Headers:', metadata.security);
        console.log('Social Metadata:', metadata.social);
        console.log('Link Analysis:', metadata.links);
        console.log('============================================');
        
        return result;
      } catch (error) {
        console.error('Error extracting website data:', error);
        return null;
      }
    }

    // Function to extract and analyze links for security assessment
    async function extractLinkMetadata(currentDomain: string): Promise<{
      externalLinksCount: number;
      suspiciousLinks: string[];
      socialMediaLinks: string[];
    }> {
      const links = document.querySelectorAll('a[href]');
      const linkData = {
        externalLinksCount: 0,
        suspiciousLinks: [] as string[],
        socialMediaLinks: [] as string[]
      };

      // Known social media domains
      const socialMediaDomains = [
        'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 
        'youtube.com', 'tiktok.com', 'snapchat.com', 'pinterest.com',
        'telegram.org', 'whatsapp.com', 'wechat.com', 'line.me'
      ];

      // Suspicious patterns in URLs
      const suspiciousPatterns = [
        /bit\.ly|tinyurl|t\.co|short|url|redirect/i,  // URL shorteners
        /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/,  // Direct IP addresses
        /urgent|immediate|act.now|limited.time|expire|verify.account/i,  // Urgency words
        /.tk$|.ml$|.ga$|.cf$/i,  // Free TLDs often used for scams
        /phishing|malware|suspicious/i  // Direct suspicious terms
      ];

      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          continue;
        }

        try {
          let linkUrl: URL;
          
          // Handle relative URLs
          if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
            linkUrl = new URL(href, window.location.origin);
          } else if (!href.startsWith('http')) {
            linkUrl = new URL(href, window.location.href);
          } else {
            linkUrl = new URL(href);
          }

          const linkDomain = linkUrl.hostname.toLowerCase();

          // Count external links
          if (linkDomain !== currentDomain && !linkDomain.endsWith(`.${currentDomain}`)) {
            linkData.externalLinksCount++;
          }

          // Check for social media links
          for (const socialDomain of socialMediaDomains) {
            if (linkDomain.includes(socialDomain)) {
              linkData.socialMediaLinks.push(href);
              break;
            }
          }

          // Check for suspicious patterns
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(href) || pattern.test(linkDomain)) {
              linkData.suspiciousLinks.push(href);
              break;
            }
          }

        } catch (error) {
          // Invalid URL, might be suspicious
          if (href.length > 10) {  // Ignore very short invalid hrefs
            linkData.suspiciousLinks.push(href);
          }
        }
      }

      // Limit arrays to prevent overwhelming the analysis
      if (linkData.suspiciousLinks.length > 10) {
        linkData.suspiciousLinks = linkData.suspiciousLinks.slice(0, 10);
      }
      if (linkData.socialMediaLinks.length > 5) {
        linkData.socialMediaLinks = linkData.socialMediaLinks.slice(0, 5);
      }

      console.log('Link analysis completed:', linkData);
      return linkData;
    }

    // Function to extract meaningful page content from DOM
    async function extractPageContent(): Promise<string> {
      console.log('Starting DOM content extraction...');
      
      // Elements to exclude from content extraction
      const excludeSelectors = [
        'script', 'style', 'link', 'meta',
        'nav', 'footer', 'aside', 'header[role="banner"]',
        '.navigation', '.navbar', '.menu', '.sidebar',
        '.ad', '.advertisement', '.ads', '[class*="ad-"]', '[id*="ad-"]',
        '.social', '.share', '.comment', '.comments',
        '.popup', '.modal', '.overlay',
        '.cookie', '.banner', '.notice',
        '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
        '.breadcrumb', '.pagination',
        'button', 'input', 'select', 'textarea', 'form'
      ];
      
      // Priority selectors for main content (in order of preference)
      const contentSelectors = [
        'main',
        '[role="main"]',
        '.main-content',
        '.content',
        '.post-content',
        '.article-content',
        '.entry-content',
        'article',
        '.container .content',
        '.page-content',
        '.body-content'
      ];
      
      let extractedContent = '';
      
      // Try to find main content area first
      for (const selector of contentSelectors) {
        const mainElement = document.querySelector(selector);
        if (mainElement) {
          console.log(`Found main content with selector: ${selector}`);
          extractedContent = extractTextFromElement(mainElement, excludeSelectors);
          if (extractedContent.trim().length > 100) { // Must have substantial content
            break;
          }
        }
      }
      
      // If no main content found or insufficient content, try body extraction
      if (extractedContent.trim().length < 100) {
        console.log('Main content insufficient, extracting from body...');
        extractedContent = extractTextFromElement(document.body, excludeSelectors);
      }
      
      // Clean and limit the content
      const cleanedContent = cleanExtractedContent(extractedContent);
      
      console.log(`Content extraction result: ${cleanedContent.length} characters`);
      return cleanedContent;
    }
    
    // Function to extract text from an element while excluding unwanted parts
    function extractTextFromElement(element: Element, excludeSelectors: string[]): string {
      // Clone the element to avoid modifying the original DOM
      const clone = element.cloneNode(true) as Element;
      
      // Remove excluded elements
      excludeSelectors.forEach(selector => {
        try {
          const elementsToRemove = clone.querySelectorAll(selector);
          elementsToRemove.forEach(el => el.remove());
        } catch (e) {
          // Ignore invalid selectors
        }
      });
      
      // Extract text content in a structured way
      let text = '';
      
      // Function to recursively extract text while preserving some structure
      function extractStructuredText(node: Node): string {
        let result = '';
        
        if (node.nodeType === Node.TEXT_NODE) {
          const textContent = node.textContent?.trim();
          if (textContent && textContent.length > 0) {
            result += textContent + ' ';
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const tagName = element.tagName?.toLowerCase();
          
          // Add structure markers for important elements
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            result += '\n### ';
          } else if (['p', 'div', 'section', 'article'].includes(tagName)) {
            result += '\n';
          } else if (['li'].includes(tagName)) {
            result += '\n• ';
          } else if (['br'].includes(tagName)) {
            result += '\n';
          }
          
          // Recursively process child nodes
          for (const child of Array.from(element.childNodes)) {
            result += extractStructuredText(child);
          }
          
          // Add spacing after block elements
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'section', 'article'].includes(tagName)) {
            result += '\n';
          }
        }
        
        return result;
      }
      
      text = extractStructuredText(clone);
      return text;
    }
    
    // Function to clean and limit extracted content
    function cleanExtractedContent(content: string): string {
      // Remove excessive whitespace and normalize line breaks
      let cleaned = content
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .replace(/^\s+|\s+$/g, '') // Trim start and end
        .replace(/\n{3,}/g, '\n\n'); // Limit consecutive line breaks to 2
      
      // Limit total length to prevent overwhelming the LLM
      const maxLength = 2500; // Conservative limit for API efficiency
      if (cleaned.length > maxLength) {
        // Try to cut at a sentence or paragraph boundary
        const truncated = cleaned.substring(0, maxLength);
        const lastSentenceEnd = Math.max(
          truncated.lastIndexOf('.'),
          truncated.lastIndexOf('!'),
          truncated.lastIndexOf('?'),
          truncated.lastIndexOf('\n\n')
        );
        
        if (lastSentenceEnd > maxLength * 0.7) { // Only cut at boundary if it's not too short
          cleaned = truncated.substring(0, lastSentenceEnd + 1) + '\n\n[Content truncated for analysis efficiency]';
        } else {
          cleaned = truncated + '...\n\n[Content truncated for analysis efficiency]';
        }
      }
      
      return cleaned;
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
          <strong>The extension sidebar will update automatically!</strong>
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

        // Extract author followers count
        let author_followers_count = undefined;
        console.log('=== Starting follower count extraction ===');
        console.log('Post element for follower extraction:', postElement);
        
        // More comprehensive follower selectors for different Facebook layouts
        const followerSelectors = [
          // Modern Facebook follower count selectors
          '[data-testid="profile-follower-count"]',
          '[data-testid="follower-count"]',
          '[data-testid="profile_header_follower_count"]',
          
          // Links to followers page
          'a[href*="followers"]',
          'a[href*="/followers/"]',
          'a[href*="&sk=followers"]',
          '.x1i10hfl[href*="followers"]',
          'a[href*="followers"] span',
          'a[href*="followers"] div',
          
          // Profile page follower indicators with various text patterns
          'div[role="button"][aria-label*="follower" i]',
          'span[aria-label*="follower" i]',
          'a[aria-label*="follower" i]',
          
          // Profile header areas
          '.x1yztbdb a[href*="followers"]',
          '.profile-header a[href*="followers"]',
          
          // Alternative data attributes
          '[data-testid*="follower"]',
          '[data-testid*="follow"]',
          
          // Text-based searches (broader approach)
          '*[aria-label*="follower" i]',
          '*[title*="follower" i]',
          
          // Profile link areas that might contain follower info
          'a[role="link"][href*="facebook.com"]',
          'a[role="link"][href*="/profile/"]',
          
          // Generic spans/divs near profile information
          '.x1yztbdb span',
          '.x1yztbdb div',
          
          // Page header information
          '[role="main"] a[href*="followers"]',
          '[role="banner"] a[href*="followers"]'
        ];

        // First, try to find any element that mentions followers
        console.log('Searching for follower-related elements...');
        const allElements = postElement.querySelectorAll('*');
        let followerCandidates = [];
        
        for (const element of allElements) {
          const text = element.textContent?.toLowerCase() || '';
          const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
          const title = element.getAttribute('title')?.toLowerCase() || '';
          const href = element.getAttribute('href')?.toLowerCase() || '';
          
          if (text.includes('follower') || ariaLabel.includes('follower') || 
              title.includes('follower') || href.includes('follower')) {
            followerCandidates.push({
              element,
              text: element.textContent?.trim(),
              ariaLabel: element.getAttribute('aria-label'),
              title: element.getAttribute('title'),
              href: element.getAttribute('href')
            });
          }
        }
        
        console.log(`Found ${followerCandidates.length} follower candidate elements:`, followerCandidates);

        // Try the specific selectors first
        for (const selector of followerSelectors) {
          try {
            const element = postElement.querySelector(selector);
            if (element) {
              console.log(`Checking follower element with selector: ${selector}`, element);
              
              // Check aria-label first
              const ariaLabel = element.getAttribute('aria-label');
              if (ariaLabel) {
                console.log(`Aria-label content: "${ariaLabel}"`);
                const followerMatch = ariaLabel.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:K|M|B)?\s*(?:follower|Follower)/i);
                if (followerMatch) {
                  author_followers_count = parseFollowerCount(followerMatch[1]);
                  console.log(`✅ Followers found in aria-label: ${followerMatch[1]} -> ${author_followers_count}`);
                  break;
                }
              }
              
              // Check text content
              const textContent = element.textContent?.trim();
              if (textContent) {
                console.log(`Text content: "${textContent}"`);
                const followerMatch = textContent.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:K|M|B)?\s*(?:follower|Follower)/i);
                if (followerMatch) {
                  author_followers_count = parseFollowerCount(followerMatch[1]);
                  console.log(`✅ Followers found in text: ${followerMatch[1]} -> ${author_followers_count}`);
                  break;
                }
              }
              
              // Check title attribute
              const title = element.getAttribute('title');
              if (title) {
                console.log(`Title attribute: "${title}"`);
                const followerMatch = title.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:K|M|B)?\s*(?:follower|Follower)/i);
                if (followerMatch) {
                  author_followers_count = parseFollowerCount(followerMatch[1]);
                  console.log(`✅ Followers found in title: ${followerMatch[1]} -> ${author_followers_count}`);
                  break;
                }
              }
            }
          } catch (e) {
            console.log(`Selector ${selector} failed:`, e);
          }
        }

        // If still no followers found, check our candidates
        if (author_followers_count === undefined && followerCandidates.length > 0) {
          console.log('No followers found with selectors, checking candidates...');
          
          for (const candidate of followerCandidates) {
            const { element, text, ariaLabel, title, href } = candidate;
            
            // Check all possible text sources
            const sources = [text, ariaLabel, title, href].filter(Boolean);
            
            for (const source of sources) {
              const followerMatch = source.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:K|M|B)?\s*(?:follower|Follower)/i);
              if (followerMatch) {
                author_followers_count = parseFollowerCount(followerMatch[1]);
                console.log(`✅ Followers found in candidate: ${followerMatch[1]} -> ${author_followers_count} from "${source}"`);
                break;
              }
            }
            
            if (author_followers_count !== undefined) break;
          }
        }

        // Helper function to parse follower count with K/M/B notation
        function parseFollowerCount(countStr: string): number {
          const cleanStr = countStr.replace(/,/g, '').toLowerCase();
          const baseNumber = parseFloat(cleanStr);
          
          if (cleanStr.includes('k')) {
            return Math.round(baseNumber * 1000);
          } else if (cleanStr.includes('m')) {
            return Math.round(baseNumber * 1000000);
          } else if (cleanStr.includes('b')) {
            return Math.round(baseNumber * 1000000000);
          } else {
            return Math.round(baseNumber);
          }
        }

        console.log(`Final follower count: ${author_followers_count || 'not found'}`);
        console.log('=== Follower count extraction complete ===');

        // Extract engagement metrics (likes, comments, shares, reactions)
        let engagement_metrics = {
          likes: undefined,
          comments: undefined,
          shares: undefined,
          reactions: undefined
        };
        
        console.log('=== Starting engagement metrics extraction ===');

        // Function to extract numeric value from text with K/M/B notation
        function parseEngagementCount(text: string): number | undefined {
          if (!text) return undefined;
          
          const cleanText = text.replace(/[^\d.KMB]/gi, '').toLowerCase();
          const match = cleanText.match(/(\d+(?:\.\d+)?)(k|m|b)?/i);
          
          if (match) {
            const baseNumber = parseFloat(match[1]);
            const suffix = match[2]?.toLowerCase();
            
            switch (suffix) {
              case 'k': return Math.round(baseNumber * 1000);
              case 'm': return Math.round(baseNumber * 1000000);
              case 'b': return Math.round(baseNumber * 1000000000);
              default: return Math.round(baseNumber);
            }
          }
          return undefined;
        }

        // Facebook engagement metrics extraction - completely rewritten for accuracy
        console.log('🔍 Starting DEEP engagement metrics extraction...');
        console.log('🏗️ Post element structure:', postElement);
        
        // Step 1: Map the entire DOM structure for debugging
        const allElementsWithText = postElement.querySelectorAll('*');
        const debugElements = [];
        
        for (const el of allElementsWithText) {
          const text = el.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const role = el.getAttribute('role') || '';
          const dataTestId = el.getAttribute('data-testid') || '';
          
          // Only log elements that might be relevant
          if (text || ariaLabel || role || dataTestId) {
            debugElements.push({
              tagName: el.tagName,
              text: text.length > 50 ? text.substring(0, 50) + '...' : text,
              ariaLabel: ariaLabel.length > 50 ? ariaLabel.substring(0, 50) + '...' : ariaLabel,
              role,
              dataTestId,
              hasNumbers: /\d/.test(text) || /\d/.test(ariaLabel),
              classes: el.className
            });
          }
        }
        
        console.log('🗺️ All potential elements in post:', debugElements.filter(el => el.hasNumbers || el.role || el.ariaLabel.includes('like') || el.ariaLabel.includes('comment') || el.ariaLabel.includes('share')));
        
        // Step 2: Find the reaction count area (usually appears above the engagement buttons)
        console.log('🔍 Searching for reaction count indicators...');
        let reactionsFound = false;
        
        // Look for elements that contain reaction emojis or summaries
        const allTextElements = postElement.querySelectorAll('span, div, a');
        for (const element of allTextElements) {
          const text = element.textContent?.trim() || '';
          const ariaLabel = element.getAttribute('aria-label') || '';
          
          // Check for reaction emoji patterns (👍❤️😆😮😢😡) followed by counts
          const hasReactionEmojis = /[👍❤️😆😮😢😡🥰😍]/.test(text) || /[👍❤️😆😮😢😡🥰😍]/.test(ariaLabel);
          
          if (hasReactionEmojis) {
            console.log('😀 Found reaction emoji element:', { text, ariaLabel, element });
            
            // Look for numbers in the same element or nearby
            const numberInSame = (text + ' ' + ariaLabel).match(/(\d+(?:,\d+)*)/);
            if (numberInSame) {
              const count = parseEngagementCount(numberInSame[1]);
              engagement_metrics.reactions = count;
              engagement_metrics.likes = count;
              console.log(`✅ Reactions found via emoji: ${count}`);
              reactionsFound = true;
              break;
            }
            
            // Check parent and sibling elements for numbers
            const parent = element.parentElement;
            const siblings = parent ? Array.from(parent.children) : [];
            
            for (const sibling of siblings) {
              const siblingText = sibling.textContent?.trim() || '';
              const siblingAria = sibling.getAttribute('aria-label') || '';
              const numberInSibling = (siblingText + ' ' + siblingAria).match(/(\d+(?:,\d+)*)/);
              
              if (numberInSibling && !siblingText.toLowerCase().includes('comment') && !siblingText.toLowerCase().includes('share')) {
                const count = parseEngagementCount(numberInSibling[1]);
                engagement_metrics.reactions = count;
                engagement_metrics.likes = count;
                console.log(`✅ Reactions found near emoji in sibling: ${count} from "${siblingText}"`);
                reactionsFound = true;
                break;
              }
            }
            if (reactionsFound) break;
          }
        }
        
        // Step 3: Look for engagement action buttons/links
        console.log('🔍 Searching for engagement buttons...');
        const engagementButtons = postElement.querySelectorAll('div[role="button"], span[role="button"], a[role="button"], a[href*="comment"], a[href*="like"], a[href*="share"]');
        
        const buttonAnalysis = [];
        for (const button of engagementButtons) {
          const text = button.textContent?.trim() || '';
          const ariaLabel = button.getAttribute('aria-label') || '';
          const href = button.getAttribute('href') || '';
          
          buttonAnalysis.push({
            text,
            ariaLabel,
            href,
            element: button,
            type: 'button'
          });
        }
        
        console.log('🎯 Engagement button analysis:', buttonAnalysis);

        // Step 4: Extract reactions using multiple strategies
        console.log('👍 Extracting reactions using systematic approach...');
        
        if (!reactionsFound) {
          // Strategy 1: Look for aria-labels with reaction descriptions
          for (const button of buttonAnalysis) {
            const { ariaLabel, text } = button;
            
            if (ariaLabel) {
              // Facebook uses patterns like "Like: 2" or "2 people reacted to this"
              const reactionPatterns = [
                /like:\s*(\d+)/i,
                /(\d+)\s*people?\s*reacted/i,
                /(\d+)\s*reaction/i,
                /you and (\d+) others? like/i,
                /(\d+)\s*like/i
              ];
              
              for (const pattern of reactionPatterns) {
                const match = ariaLabel.match(pattern);
                if (match) {
                  const count = parseEngagementCount(match[1]);
                  if (count !== undefined) {
                    engagement_metrics.reactions = count;
                    engagement_metrics.likes = count;
                    console.log(`✅ Reactions found in button aria-label: "${ariaLabel}" -> ${count}`);
                    reactionsFound = true;
                    break;
                  }
                }
              }
              if (reactionsFound) break;
            }
          }
        }
        
        // Strategy 2: Look for clickable reaction summary areas
        if (!reactionsFound) {
          console.log('🔍 Looking for clickable reaction summaries...');
          const clickableElements = postElement.querySelectorAll('[role="button"], a, [tabindex]');
          
          for (const element of clickableElements) {
            const text = element.textContent?.trim() || '';
            const ariaLabel = element.getAttribute('aria-label') || '';
            
            // Look for reaction emoji patterns with numbers
            if (/[👍❤️😆😮😢😡🥰😍]/.test(text) || /[👍❤️😆😮😢😡🥰😍]/.test(ariaLabel)) {
              // Check for numbers in text or aria-label
              const numberMatch = (text + ' ' + ariaLabel).match(/(\d+(?:,\d+)*)/);
              if (numberMatch) {
                const count = parseEngagementCount(numberMatch[1]);
                if (count !== undefined) {
                  engagement_metrics.reactions = count;
                  engagement_metrics.likes = count;
                  console.log(`✅ Reactions found in clickable emoji area: "${text || ariaLabel}" -> ${count}`);
                  reactionsFound = true;
                  break;
                }
              }
            }
            
            // Check for text patterns like "You and 1 other"
            const youAndOtherMatch = (text + ' ' + ariaLabel).match(/you and (\d+) other/i);
            if (youAndOtherMatch) {
              const count = parseEngagementCount(youAndOtherMatch[1]) + 1; // +1 for "you"
              engagement_metrics.reactions = count;
              engagement_metrics.likes = count;
              console.log(`✅ Reactions found in "you and others": "${text || ariaLabel}" -> ${count}`);
              reactionsFound = true;
              break;
            }
          }
        }
        
        // Strategy 3: Check for standalone numbers near like buttons
        if (!reactionsFound) {
          console.log('🔍 Looking for numbers near like buttons...');
          for (const button of buttonAnalysis) {
            const { element, text, ariaLabel } = button;
            
            // Check if this is a like button
            const isLikeButton = ariaLabel.toLowerCase().includes('like') || 
                               text.toLowerCase().includes('like');
            
            if (isLikeButton) {
              // Look for numbers in nearby elements
              const parent = element.parentElement;
              if (parent) {
                const nearbyElements = Array.from(parent.querySelectorAll('span, div'));
                for (const nearby of nearbyElements) {
                  const nearbyText = nearby.textContent?.trim() || '';
                  if (/^\d+$/.test(nearbyText)) {
                    const count = parseEngagementCount(nearbyText);
                    if (count !== undefined) {
                      engagement_metrics.reactions = count;
                      engagement_metrics.likes = count;
                      console.log(`✅ Reactions found near like button: "${nearbyText}" -> ${count}`);
                      reactionsFound = true;
                      break;
                    }
                  }
                }
                if (reactionsFound) break;
              }
            }
          }
        }
        
        // Default: If no reactions found, assume 0
        if (!reactionsFound) {
          engagement_metrics.reactions = 0;
          engagement_metrics.likes = 0;
          console.log('👍 No reactions found, assuming 0');
        }

        // Step 5: Extract comments systematically
        console.log('💬 Extracting comments systematically...');
        
        let commentsFound = false;
        
        // Strategy 1: Look for comment buttons with counts in aria-label
        for (const button of buttonAnalysis) {
          const { ariaLabel, text } = button;
          
          if (ariaLabel && ariaLabel.toLowerCase().includes('comment')) {
            // Facebook uses patterns like "Comment: 5" or "5 comments"
            const commentPatterns = [
              /comment:\s*(\d+)/i,
              /(\d+)\s*comments?/i,
              /(\d+)\s*people?\s*commented/i
            ];
            
            for (const pattern of commentPatterns) {
              const match = ariaLabel.match(pattern);
              if (match) {
                const count = parseEngagementCount(match[1]);
                if (count !== undefined) {
                  engagement_metrics.comments = count;
                  console.log(`✅ Comments found in button aria-label: "${ariaLabel}" -> ${count}`);
                  commentsFound = true;
                  break;
                }
              }
            }
            if (commentsFound) break;
          }
        }
        
        // Strategy 2: Look for comment links or clickable areas
        if (!commentsFound) {
          console.log('🔍 Looking for comment links...');
          const commentLinks = postElement.querySelectorAll('a[href*="comment"], [role="button"]');
          
          for (const link of commentLinks) {
            const text = link.textContent?.trim() || '';
            const ariaLabel = link.getAttribute('aria-label') || '';
            const href = link.getAttribute('href') || '';
            
            // Check if this is comment-related
            const isCommentRelated = text.toLowerCase().includes('comment') || 
                                   ariaLabel.toLowerCase().includes('comment') ||
                                   href.includes('comment');
            
            if (isCommentRelated) {
              // Look for numbers in text or aria-label
              const numberMatch = (text + ' ' + ariaLabel).match(/(\d+(?:,\d+)*)/);
              if (numberMatch) {
                const count = parseEngagementCount(numberMatch[1]);
                if (count !== undefined) {
                  engagement_metrics.comments = count;
                  console.log(`✅ Comments found in comment link: "${text || ariaLabel}" -> ${count}`);
                  commentsFound = true;
                  break;
                }
              }
            }
          }
        }
        
        // Strategy 3: Look for standalone comment indicators
        if (!commentsFound) {
          console.log('🔍 Looking for standalone comment indicators...');
          for (const button of buttonAnalysis) {
            const { element, text, ariaLabel } = button;
            
            // Check if this is a comment button
            const isCommentButton = ariaLabel.toLowerCase().includes('comment') || 
                                  text.toLowerCase().includes('comment');
            
            if (isCommentButton) {
              // Look for numbers in nearby elements
              const parent = element.parentElement;
              if (parent) {
                const nearbyElements = Array.from(parent.querySelectorAll('span, div'));
                for (const nearby of nearbyElements) {
                  const nearbyText = nearby.textContent?.trim() || '';
                  if (/^\d+$/.test(nearbyText)) {
                    const count = parseEngagementCount(nearbyText);
                    if (count !== undefined) {
                      engagement_metrics.comments = count;
                      console.log(`✅ Comments found near comment button: "${nearbyText}" -> ${count}`);
                      commentsFound = true;
                      break;
                    }
                  }
                }
                if (commentsFound) break;
              }
            }
          }
        }
        
        // Default: If no comments found, assume 0
        if (!commentsFound) {
          engagement_metrics.comments = 0;
          console.log('💬 No comments found, assuming 0');
        }

        // Step 6: Extract shares systematically
        console.log('🔄 Extracting shares systematically...');
        
        let sharesFound = false;
        
        // Strategy 1: Look for share buttons with counts in aria-label
        for (const button of buttonAnalysis) {
          const { ariaLabel, text } = button;
          
          if (ariaLabel && ariaLabel.toLowerCase().includes('share')) {
            // Facebook uses patterns like "Share: 2" or "2 shares"
            const sharePatterns = [
              /share:\s*(\d+)/i,
              /(\d+)\s*shares?/i,
              /(\d+)\s*people?\s*shared/i
            ];
            
            for (const pattern of sharePatterns) {
              const match = ariaLabel.match(pattern);
              if (match) {
                const count = parseEngagementCount(match[1]);
                if (count !== undefined) {
                  engagement_metrics.shares = count;
                  console.log(`✅ Shares found in button aria-label: "${ariaLabel}" -> ${count}`);
                  sharesFound = true;
                  break;
                }
              }
            }
            if (sharesFound) break;
          }
        }
        
        // Strategy 2: Look for share links or clickable areas
        if (!sharesFound) {
          console.log('🔍 Looking for share links...');
          const shareLinks = postElement.querySelectorAll('a[href*="share"], [role="button"]');
          
          for (const link of shareLinks) {
            const text = link.textContent?.trim() || '';
            const ariaLabel = link.getAttribute('aria-label') || '';
            const href = link.getAttribute('href') || '';
            
            // Check if this is share-related
            const isShareRelated = text.toLowerCase().includes('share') || 
                                 ariaLabel.toLowerCase().includes('share') ||
                                 href.includes('share');
            
            if (isShareRelated) {
              // Look for numbers in text or aria-label
              const numberMatch = (text + ' ' + ariaLabel).match(/(\d+(?:,\d+)*)/);
              if (numberMatch) {
                const count = parseEngagementCount(numberMatch[1]);
                if (count !== undefined) {
                  engagement_metrics.shares = count;
                  console.log(`✅ Shares found in share link: "${text || ariaLabel}" -> ${count}`);
                  sharesFound = true;
                  break;
                }
              }
            }
          }
        }
        
        // Strategy 3: Look for standalone share indicators
        if (!sharesFound) {
          console.log('🔍 Looking for standalone share indicators...');
          for (const button of buttonAnalysis) {
            const { element, text, ariaLabel } = button;
            
            // Check if this is a share button
            const isShareButton = ariaLabel.toLowerCase().includes('share') || 
                                 text.toLowerCase().includes('share');
            
            if (isShareButton) {
              // Look for numbers in nearby elements
              const parent = element.parentElement;
              if (parent) {
                const nearbyElements = Array.from(parent.querySelectorAll('span, div'));
                for (const nearby of nearbyElements) {
                  const nearbyText = nearby.textContent?.trim() || '';
                  if (/^\d+$/.test(nearbyText)) {
                    const count = parseEngagementCount(nearbyText);
                    if (count !== undefined) {
                      engagement_metrics.shares = count;
                      console.log(`✅ Shares found near share button: "${nearbyText}" -> ${count}`);
                      sharesFound = true;
                      break;
                    }
                  }
                }
                if (sharesFound) break;
              }
            }
          }
        }
        
        // Default: If no shares found, assume 0
        if (!sharesFound) {
          engagement_metrics.shares = 0;
          console.log('🔄 No shares found, assuming 0');
        }

        // Filter out undefined values and only include metrics that were actually found
        const cleanedEngagementMetrics: { [key: string]: number } = {};
        Object.entries(engagement_metrics).forEach(([key, value]) => {
          if (value !== undefined) {
            cleanedEngagementMetrics[key] = value;
          }
        });

        console.log('🎯 Final engagement metrics:', cleanedEngagementMetrics);
        console.log('📊 Detailed breakdown:');
        console.log(`  👍 Reactions/Likes: ${engagement_metrics.reactions || 0} (found: ${reactionsFound})`);
        console.log(`  💬 Comments: ${engagement_metrics.comments || 0} (found: ${commentsFound})`);
        console.log(`  🔄 Shares: ${engagement_metrics.shares || 0} (found: ${sharesFound})`);
        console.log('=== Engagement metrics extraction complete ===');

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
          timestamp,
          author_followers_count,
          engagement_metrics: Object.keys(cleanedEngagementMetrics).length > 0 ? cleanedEngagementMetrics : undefined
        };

        console.log('=== Facebook Post Extraction Complete ===');
        console.log('Final result:', result);
        console.log('Username found:', username !== 'Unknown User');
        console.log('Caption found:', caption !== 'No caption found');
        console.log('Image found:', !!image);
        console.log('Timestamp found:', !!timestamp);
        console.log('Follower count found:', !!author_followers_count, author_followers_count ? `(${author_followers_count})` : '');
        console.log('Engagement metrics found:', Object.keys(cleanedEngagementMetrics).length > 0, cleanedEngagementMetrics);
        console.log('============================================');

        return result;
      } catch (error) {
        console.error('Error extracting post data:', error);
        return null;
      }
    }

    // Function to create and show analysis modal on the website
    function showAnalysisModal(result: any, loading: boolean = false, analysisType: 'email' | 'website' | 'social_media' = 'email') {
      // Check if this is a website analysis with medium/high risk - use protection system instead
      if (analysisType === 'website' && result && !loading) {
        const riskLevel = result.risk_level || result.data?.risk_level;
        if (riskLevel && isHighOrMediumRisk(riskLevel)) {
          console.log('🛡️ High/medium risk website detected, showing protection system instead of regular modal');
          
          // Remove any existing analysis modal first (including loading modal)
          const existingModal = document.getElementById('maiscam-analysis-modal');
          if (existingModal) {
            existingModal.remove();
            console.log('🗑️ Removed existing analysis modal before showing protection system');
          }
          
          showWebsiteProtection(result);
          return;
        }
      }

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
      title.textContent = 'mAIscam Alert';

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
        loadingText.textContent = analysisType === 'email' ? 'Analyzing email...' : 
                                 analysisType === 'website' ? 'Analyzing website...' : 
                                 'Analyzing social media post...';
        
        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(loadingText);
        body.appendChild(loadingDiv);

        // Add CSS animation for spinner
        const style = document.createElement('style');
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      } else if (result) {
        // Analysis result
        const getRiskColor = (riskLevel: string) => {
          const level = riskLevel.toLowerCase();
          
          // High risk patterns (English, Chinese, Malay, Indonesian, Vietnamese, Thai, Filipino, etc.)
          if (level === 'high' || level === '高' || level === '高风险' || level === 'tinggi' || level === 'risiko tinggi' || 
              level === 'cao' || level === 'rủi ro cao' || level === 'สูง' || level === 'ความเสี่ยงสูง' || 
              level === 'mataas' || level === 'dhuwur' || level === 'luhur') {
            return '#dc2626'; // Darker red for high severity
          }
          
          // Medium risk patterns (English, Chinese, Malay, Indonesian, Vietnamese, Thai, Filipino, etc.)
          if (level === 'medium' || level === 'medium risk' || level === '中' || level === '中等' || level === '中等风险' || 
              level === 'sederhana' || level === 'risiko sederhana' || level === 'trung bình' || level === 'rủi ro trung bình' || 
              level === 'ปานกลาง' || level === 'ความเสี่ยงปานกลาง' || level === 'katamtaman' || 
              level === 'madya' || level === 'sedeng') {
            return '#d97706'; // Yellow/amber for medium
          }
          
          // Default to green for low risk (covers 'low', '低', 'rendah', 'thấp', 'ต่ำ', 'mababa', etc.)
          return '#16a34a'; // Green for low risk
        };

        const getRiskBg = (riskLevel: string) => {
          const level = riskLevel.toLowerCase();
          
          // High risk patterns
          if (level === 'high' || level === '高' || level === '高风险' || level === 'tinggi' || level === 'risiko tinggi' || 
              level === 'cao' || level === 'rủi ro cao' || level === 'สูง' || level === 'ความเสี่ยงสูง' || 
              level === 'mataas' || level === 'dhuwur' || level === 'luhur') {
            return '#fef2f2'; // Light red background
          }
          
          // Medium risk patterns  
          if (level === 'medium' || level === 'medium risk' || level === '中' || level === '中等' || level === '中等风险' || 
              level === 'sederhana' || level === 'risiko sederhana' || level === 'trung bình' || level === 'rủi ro trung bình' || 
              level === 'ปานกลาง' || level === 'ความเสี่ยงปานกลาง' || level === 'katamtaman' || 
              level === 'madya' || level === 'sedeng') {
            return '#fffbeb'; // Light yellow background
          }
          
          // Default to green background for low risk
          return '#f0fdf4'; // Light green background
        };

        const getRiskBorder = (riskLevel: string) => {
          const level = riskLevel.toLowerCase();
          
          // High risk patterns
          if (level === 'high' || level === '高' || level === '高风险' || level === 'tinggi' || level === 'risiko tinggi' || 
              level === 'cao' || level === 'rủi ro cao' || level === 'สูง' || level === 'ความเสี่ยงสูง' || 
              level === 'mataas' || level === 'dhuwur' || level === 'luhur') {
            return '#fca5a5'; // Red border
          }
          
          // Medium risk patterns
          if (level === 'medium' || level === 'medium risk' || level === '中' || level === '中等' || level === '中等风险' || 
              level === 'sederhana' || level === 'risiko sederhana' || level === 'trung bình' || level === 'rủi ro trung bình' || 
              level === 'ปานกลาง' || level === 'ความเสี่ยงปานกลาง' || level === 'katamtaman' || 
              level === 'madya' || level === 'sedeng') {
            return '#fde68a'; // Yellow border
          }
          
          // Default to green border for low risk
          return '#bbf7d0'; // Green border
        };

        // Risk level badge
        const riskContainer = document.createElement('div');
        riskContainer.style.cssText = 'text-align: center; margin-bottom: 24px;';
        
        // Translate risk level to target language if needed
        const translateRiskLevel = (riskLevel: string, targetLang: string) => {
          const level = riskLevel.toLowerCase();
          
          if (targetLang === 'zh') {
            // Chinese translations
            if (level === 'high') return '高风险';
            if (level === 'medium') return '中等风险';
            if (level === 'low') return '低风险';
          } else if (targetLang === 'ms') {
            // Malay translations
            if (level === 'high') return 'RISIKO TINGGI';
            if (level === 'medium') return 'RISIKO SEDERHANA';
            if (level === 'low') return 'RISIKO RENDAH';
          } else if (targetLang === 'vi') {
            // Vietnamese translations
            if (level === 'high') return 'RỦI RO CAO';
            if (level === 'medium') return 'RỦI RO TRUNG BÌNH';
            if (level === 'low') return 'RỦI RO THẤP';
          } else if (targetLang === 'th') {
            // Thai translations
            if (level === 'high') return 'ความเสี่ยงสูง';
            if (level === 'medium') return 'ความเสี่ยงปานกลาง';
            if (level === 'low') return 'ความเสี่ยงต่ำ';
          } else {
            // Default to English
            if (level === 'high') return 'HIGH RISK';
            if (level === 'medium') return 'MEDIUM RISK';
            if (level === 'low') return 'LOW RISK';
          }
          
          // Fallback to original if no translation found
          return riskLevel.toUpperCase();
        };

        const displayRiskLevel = translateRiskLevel(result.risk_level, result.target_language || 'en');
        
        const riskBadge = document.createElement('div');
        riskBadge.style.cssText = `
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          border-radius: 9999px;
          color: white;
          font-weight: 600;
          background-color: ${getRiskColor(displayRiskLevel)};
          margin-bottom: 8px;
        `;
        riskBadge.innerHTML = `<span style="margin-right: 8px;">⚠️</span>${displayRiskLevel}`;
        
        riskContainer.appendChild(riskBadge);

        // Language information section (create but don't append yet)
        let languageBox = null;
        if (result.detected_language || result.target_language) {
          languageBox = document.createElement('div');
          languageBox.style.cssText = `
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #d1d5db;
            background-color: #f9fafb;
            margin-bottom: 16px;
          `;
          
          const languageTitle = document.createElement('h4');
          languageTitle.style.cssText = `
            font-weight: 600;
            color: #6b7280;
            margin: 0 0 8px 0;
            font-size: 13px;
          `;
          languageTitle.textContent = '🌐 Language Detection';
          
          const languageInfo = document.createElement('div');
          languageInfo.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
          
          if (result.detected_language) {
            const detectedLang = document.createElement('div');
            detectedLang.style.cssText = 'font-size: 12px; color: #4b5563;';
            detectedLang.innerHTML = `<strong>Detected:</strong> ${result.detected_language.toUpperCase()}`;
            languageInfo.appendChild(detectedLang);
          }
          
          if (result.target_language && result.target_language_name) {
            const targetLang = document.createElement('div');
            targetLang.style.cssText = 'font-size: 12px; color: #4b5563;';
            targetLang.innerHTML = `<strong>Analysis in:</strong> ${result.target_language_name}`;
            languageInfo.appendChild(targetLang);
          }
          
          languageBox.appendChild(languageTitle);
          languageBox.appendChild(languageInfo);
        }

        // Analysis section
        const analysisBox = document.createElement('div');
        analysisBox.style.cssText = `
          padding: 16px;
          border-radius: 8px;
          border: 1px solid ${getRiskBorder(displayRiskLevel)};
          background-color: ${getRiskBg(displayRiskLevel)};
          margin-bottom: 16px;
        `;
        
        const analysisTitle = document.createElement('h4');
        analysisTitle.style.cssText = `
          font-weight: 600;
          color: ${getRiskColor(displayRiskLevel)};
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
          border: 1px solid ${getRiskBorder(displayRiskLevel)};
          background-color: ${getRiskBg(displayRiskLevel)};
          margin-bottom: 16px;
        `;
        
        const actionTitle = document.createElement('h4');
        actionTitle.style.cssText = `
          font-weight: 600;
          color: ${getRiskColor(displayRiskLevel)};
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
        footer.textContent = 'Analysis powered by mAIscam';

        body.appendChild(riskContainer);
        if (languageBox) {
          body.appendChild(languageBox);
        }
        body.appendChild(analysisBox);
        body.appendChild(actionBox);
        body.appendChild(buttonContainer);
        body.appendChild(footer);
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
      
      // Log successful modal display
      console.log(`✅ Analysis modal displayed on website for ${analysisType} analysis`);
    }

    // Function to show analysis error modal
    function showAnalysisError(errorMessage: string) {
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
      icon.textContent = '⚠️';

      const title = document.createElement('h3');
      title.style.cssText = 'font-size: 18px; font-weight: 600; color: #111827; margin: 0;';
      title.textContent = 'Analysis Error';

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

      const errorBox = document.createElement('div');
      errorBox.style.cssText = `
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #fecaca;
        background-color: #fef2f2;
        margin-bottom: 16px;
      `;
      
      const errorText = document.createElement('p');
      errorText.style.cssText = 'color: #374151; font-size: 14px; line-height: 1.5; margin: 0;';
      errorText.textContent = errorMessage;
      
      errorBox.appendChild(errorText);

      const closeOnlyButton = document.createElement('button');
      closeOnlyButton.style.cssText = `
        width: 100%;
        background-color: #ef4444;
        color: white;
        font-weight: 500;
        padding: 8px 16px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
      `;
      closeOnlyButton.textContent = 'Close';
      closeOnlyButton.onmouseover = () => closeOnlyButton.style.backgroundColor = '#dc2626';
      closeOnlyButton.onmouseout = () => closeOnlyButton.style.backgroundColor = '#ef4444';
      closeOnlyButton.onclick = () => modalContainer.remove();

      body.appendChild(errorBox);
      body.appendChild(closeOnlyButton);

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

    // Function to convert image URL to base64
    async function convertImageToBase64(imageUrl: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }
            
            canvas.width = img.width;
            canvas.height = img.height;
            
            ctx.drawImage(img, 0, 0);
            
            // Get base64 string without the data:image/jpeg;base64, prefix
            const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            resolve(base64);
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        // Set crossOrigin before setting src
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
      });
    }

    // Listen for messages from popup requesting data
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_GMAIL_DATA') {
        extractGmailData().then((gmailData) => {
          console.log('Manual Gmail data extraction requested:', gmailData);
          sendResponse(gmailData);
        }).catch((error) => {
          console.error('Error extracting Gmail data:', error);
          sendResponse(null);
        });
        return true; // Indicates we will send a response asynchronously
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
      } else if (message.type === 'SHOW_ANALYSIS_MODAL') {
        console.log('Showing analysis modal on website:', message.result, 'Type:', message.analysisType);
        showAnalysisModal(message.result, message.loading || false, message.analysisType || 'email');
        sendResponse({ success: true });
      } else if (message.type === 'SHOW_ANALYSIS_ERROR') {
        console.log('Showing analysis error modal on website:', message.error);
        showAnalysisError(message.error);
        sendResponse({ success: true });
      } else if (message.type === 'CONVERT_IMAGE_TO_BASE64') {
        console.log('Converting image to base64:', message.imageUrl);
        convertImageToBase64(message.imageUrl).then((base64) => {
          sendResponse({ success: true, base64 });
        }).catch((error) => {
          console.error('Failed to convert image to base64:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true; // Indicates we will send a response asynchronously
      }
    });

    // Risk-based website protection system
    let isWebsiteBlurred = false;
    let blurOverlay: HTMLElement | null = null;
    let warningModal: HTMLElement | null = null;

    // Function to check if risk level is medium or high in any language
    function isHighOrMediumRisk(riskLevel: string): boolean {
      const level = riskLevel.toLowerCase();
      
      // High risk patterns (English, Chinese, Malay, Indonesian, Vietnamese, Thai, Filipino, etc.)
      const highRiskPatterns = ['high', '高', '高风险', 'tinggi', 'risiko tinggi', 
                               'cao', 'rủi ro cao', 'สูง', 'ความเสี่ยงสูง', 
                               'mataas', 'dhuwur', 'luhur'];
      
      // Medium risk patterns (English, Chinese, Malay, Indonesian, Vietnamese, Thai, Filipino, etc.)
      const mediumRiskPatterns = ['medium', 'medium risk', '中', '中等', '中等风险', 
                                 'sederhana', 'risiko sederhana', 'trung bình', 'rủi ro trung bình', 
                                 'ปานกลาง', 'ความเสี่ยงปานกลาง', 'katamtaman', 
                                 'madya', 'sedeng'];
      
      return highRiskPatterns.some(pattern => level.includes(pattern)) ||
             mediumRiskPatterns.some(pattern => level.includes(pattern));
    }

    // Function to create blur overlay
    function createBlurOverlay(): HTMLElement {
      const overlay = document.createElement('div');
      overlay.id = 'maiscam-blur-overlay';
      overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        background-color: rgba(0, 0, 0, 0.3) !important;
        z-index: 999998 !important;
        pointer-events: none !important;
      `;
      return overlay;
    }

    // Multilingual text for warning modal
    function getWarningModalTexts(language: string = 'en') {
      const texts = {
        en: {
          title: 'SECURITY WARNING',
          subtitle: 'This website may pose a security risk',
          proceedTitle: '⚠️ Proceed at Your Own Risk',
          proceedText: 'If you understand the risks and still wish to continue, type "I UNDERSTAND" below:',
          placeholder: 'Type "I UNDERSTAND" to continue',
          continueButton: 'CONTINUE TO WEBSITE',
          leaveButton: '🚪 LEAVE THIS WEBSITE TO SAFETY WEBSITE',
          reportButton: '📢 REPORT SITE',
          reportMessage: 'Thank you for reporting this website. We will investigate it.',
          footer: 'Protected by mAIscam Browser Extension',
          recommendedAction: 'Recommended Action:',
          passcode: 'I UNDERSTAND'
        },
        zh: {
          title: '安全警告',
          subtitle: '此网站可能存在安全风险',
          proceedTitle: '⚠️ 风险自负',
          proceedText: '如果您了解风险并仍希望继续，请在下方输入"我明白"：',
          placeholder: '输入"我明白"以继续',
          continueButton: '继续访问网站',
          leaveButton: '🚪 前往谷歌',
          reportButton: '📢 举报网站',
          reportMessage: '感谢您举报此网站。我们将对其进行调查。',
          footer: 'mAIscam 浏览器扩展保护',
          recommendedAction: '建议操作：',
          passcode: '我明白'
        },
        ms: {
          title: 'AMARAN KESELAMATAN',
          subtitle: 'Laman web ini mungkin menimbulkan risiko keselamatan',
          proceedTitle: '⚠️ Teruskan Atas Risiko Sendiri',
          proceedText: 'Jika anda memahami risiko dan masih ingin meneruskan, taip "SAYA FAHAM" di bawah:',
          placeholder: 'Taip "SAYA FAHAM" untuk meneruskan',
          continueButton: 'TERUSKAN KE LAMAN WEB',
          leaveButton: '🚪 PERGI KE GOOGLE',
          reportButton: '📢 LAPORKAN LAMAN',
          reportMessage: 'Terima kasih kerana melaporkan laman web ini. Kami akan menyiasatnya.',
          footer: 'Dilindungi oleh Sambungan Pelayar mAIscam',
          recommendedAction: 'Tindakan Disyorkan:',
          passcode: 'SAYA FAHAM'
        },
        vi: {
          title: 'CẢNH BÁO BẢO MẬT',
          subtitle: 'Trang web này có thể gây rủi ro bảo mật',
          proceedTitle: '⚠️ Tiếp Tục Với Rủi Ro Của Bạn',
          proceedText: 'Nếu bạn hiểu rủi ro và vẫn muốn tiếp tục, hãy gõ "TÔI HIỂU" bên dưới:',
          placeholder: 'Gõ "TÔI HIỂU" để tiếp tục',
          continueButton: 'TIẾP TỤC ĐẾN TRANG WEB',
          leaveButton: '🚪 ĐẾN GOOGLE',
          reportButton: '📢 BÁO CÁO TRANG',
          reportMessage: 'Cảm ơn bạn đã báo cáo trang web này. Chúng tôi sẽ điều tra.',
          footer: 'Được bảo vệ bởi Tiện ích mở rộng mAIscam',
          recommendedAction: 'Hành Động Được Khuyến Nghị:',
          passcode: 'TÔI HIỂU'
        },
        th: {
          title: 'คำเตือนด้านความปลอดภัย',
          subtitle: 'เว็บไซต์นี้อาจก่อให้เกิดความเสี่ยงด้านความปลอดภัย',
          proceedTitle: '⚠️ ดำเนินการต่อโดยความเสี่ยงของคุณเอง',
          proceedText: 'หากคุณเข้าใจความเสี่ยงและยังคงต้องการดำเนินการต่อ ให้พิมพ์ "ฉันเข้าใจ" ด้านล่าง:',
          placeholder: 'พิมพ์ "ฉันเข้าใจ" เพื่อดำเนินการต่อ',
          continueButton: 'ดำเนินการต่อไปยังเว็บไซต์',
          leaveButton: '🚪 ไปที่ GOOGLE',
          reportButton: '📢 รายงานเว็บไซต์',
          reportMessage: 'ขอบคุณสำหรับการรายงานเว็บไซต์นี้ เราจะตรวจสอบ',
          footer: 'ได้รับการปกป้องโดย mAIscam Browser Extension',
          recommendedAction: 'การดำเนินการที่แนะนำ:',
          passcode: 'ฉันเข้าใจ'
        }
      };
      
      return texts[language] || texts.en;
    }

    // Function to create warning modal with passcode input
    function createWarningModal(analysisResult: any): HTMLElement {
      // Determine language from analysis result
      const language = analysisResult.detected_language || analysisResult.target_language || 'en';
      const texts = getWarningModalTexts(language);
      
      const modalContainer = document.createElement('div');
      modalContainer.id = 'maiscam-warning-modal';
      modalContainer.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background-color: rgba(0, 0, 0, 0.8) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 999999 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      `;

      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white !important;
        border-radius: 12px !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
        max-width: 500px !important;
        width: 90% !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
        position: relative !important;
      `;

      // Header with warning icon
      const header = document.createElement('div');
      header.style.cssText = `
        background: linear-gradient(135deg, #dc2626, #ef4444) !important;
        color: white !important;
        padding: 20px !important;
        text-align: center !important;
        border-radius: 12px 12px 0 0 !important;
      `;
      
      const warningIcon = document.createElement('div');
      warningIcon.style.cssText = `
        font-size: 48px !important;
        margin-bottom: 10px !important;
      `;
      warningIcon.textContent = '⚠️';
      
      const title = document.createElement('h2');
      title.style.cssText = `
        margin: 0 !important;
        font-size: 24px !important;
        font-weight: 700 !important;
      `;
      title.textContent = texts.title;
      
      const subtitle = document.createElement('p');
      subtitle.style.cssText = `
        margin: 8px 0 0 0 !important;
        font-size: 14px !important;
        opacity: 0.9 !important;
      `;
      subtitle.textContent = texts.subtitle;
      
      header.appendChild(warningIcon);
      header.appendChild(title);
      header.appendChild(subtitle);

      // Body with risk information
      const body = document.createElement('div');
      body.style.cssText = `
        padding: 24px !important;
      `;

      // Risk level display
      const riskLevel = analysisResult.risk_level || analysisResult.data?.risk_level || 'Unknown';
      const riskBadge = document.createElement('div');
      riskBadge.style.cssText = `
        display: inline-flex !important;
        align-items: center !important;
        padding: 8px 16px !important;
        border-radius: 9999px !important;
        color: white !important;
        font-weight: 600 !important;
        background-color: #dc2626 !important;
        margin-bottom: 16px !important;
      `;
      riskBadge.innerHTML = `<span style="margin-right: 8px;">🚨</span>${riskLevel.toUpperCase()}`;

      // Analysis text
      const analysis = analysisResult.analysis || analysisResult.reasons || analysisResult.data?.analysis || 'This website has been flagged as potentially dangerous.';
      const analysisText = document.createElement('div');
      analysisText.style.cssText = `
        background: #fef2f2 !important;
        border: 1px solid #fca5a5 !important;
        border-radius: 8px !important;
        padding: 16px !important;
        margin-bottom: 20px !important;
        color: #374151 !important;
        line-height: 1.5 !important;
      `;
      analysisText.textContent = analysis;

      // Recommended action
      const recommendedAction = analysisResult.recommended_action || analysisResult.data?.recommended_action || 'We recommend leaving this website immediately.';
      const actionText = document.createElement('div');
      actionText.style.cssText = `
        background: #fffbeb !important;
        border: 1px solid #fde68a !important;
        border-radius: 8px !important;
        padding: 16px !important;
        margin-bottom: 24px !important;
        color: #374151 !important;
        line-height: 1.5 !important;
      `;
      actionText.innerHTML = `<strong>💡 ${texts.recommendedAction}</strong><br/>${recommendedAction}`;

      // Acknowledgment section
      const ackSection = document.createElement('div');
      ackSection.style.cssText = `
        border: 2px solid #dc2626 !important;
        border-radius: 8px !important;
        padding: 20px !important;
        margin-bottom: 20px !important;
        background: #fef2f2 !important;
      `;

      const ackTitle = document.createElement('h3');
      ackTitle.style.cssText = `
        margin: 0 0 12px 0 !important;
        color: #dc2626 !important;
        font-size: 16px !important;
        font-weight: 600 !important;
      `;
      ackTitle.textContent = texts.proceedTitle;

      const ackText = document.createElement('p');
      ackText.style.cssText = `
        margin: 0 0 16px 0 !important;
        color: #374151 !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
      `;
      ackText.textContent = texts.proceedText;

      const passcodeInput = document.createElement('input');
      passcodeInput.type = 'text';
      passcodeInput.placeholder = texts.placeholder;
      passcodeInput.style.cssText = `
        width: 100% !important;
        padding: 12px !important;
        border: 2px solid #d1d5db !important;
        border-radius: 6px !important;
        font-size: 14px !important;
        margin-bottom: 12px !important;
        box-sizing: border-box !important;
      `;

      const continueButton = document.createElement('button');
      continueButton.textContent = texts.continueButton;
      continueButton.disabled = true;
      continueButton.style.cssText = `
        width: 100% !important;
        padding: 12px !important;
        background-color: #d1d5db !important;
        color: #6b7280 !important;
        border: none !important;
        border-radius: 6px !important;
        font-weight: 600 !important;
        cursor: not-allowed !important;
        transition: all 0.2s !important;
      `;

      // Passcode validation
      passcodeInput.addEventListener('input', () => {
        const value = passcodeInput.value.trim().toUpperCase();
        if (value === texts.passcode.toUpperCase()) {
          continueButton.disabled = false;
          continueButton.style.cssText = `
            width: 100% !important;
            padding: 12px !important;
            background-color: #dc2626 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
          `;
        } else {
          continueButton.disabled = true;
          continueButton.style.cssText = `
            width: 100% !important;
            padding: 12px !important;
            background-color: #d1d5db !important;
            color: #6b7280 !important;
            border: none !important;
            border-radius: 6px !important;
            font-weight: 600 !important;
            cursor: not-allowed !important;
            transition: all 0.2s !important;
          `;
        }
      });

      // Continue button action
      continueButton.addEventListener('click', () => {
        if (!continueButton.disabled) {
          removeWebsiteProtection();
        }
      });

      ackSection.appendChild(ackTitle);
      ackSection.appendChild(ackText);
      ackSection.appendChild(passcodeInput);
      ackSection.appendChild(continueButton);

      // Action buttons
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: flex !important;
        gap: 12px !important;
        margin-top: 20px !important;
      `;

      const leaveButton = document.createElement('button');
      leaveButton.textContent = texts.leaveButton;
      leaveButton.style.cssText = `
        flex: 1 !important;
        padding: 12px !important;
        background-color: #16a34a !important;
        color: white !important;
        border: none !important;
        border-radius: 6px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: background-color 0.2s !important;
      `;
      leaveButton.addEventListener('click', () => {
        // Clean up all modals before leaving
        cleanupAllModals();
        // Redirect to Google.com for safety instead of going back
        window.location.href = 'https://www.google.com';
      });
      leaveButton.addEventListener('mouseover', () => {
        leaveButton.style.backgroundColor = '#15803d';
      });
      leaveButton.addEventListener('mouseout', () => {
        leaveButton.style.backgroundColor = '#16a34a';
      });

      const reportButton = document.createElement('button');
      reportButton.textContent = texts.reportButton;
      reportButton.style.cssText = `
        flex: 1 !important;
        padding: 12px !important;
        background-color: #3b82f6 !important;
        color: white !important;
        border: none !important;
        border-radius: 6px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: background-color 0.2s !important;
      `;
      reportButton.addEventListener('click', () => {
        // You can implement reporting functionality here
        alert(texts.reportMessage);
      });
      reportButton.addEventListener('mouseover', () => {
        reportButton.style.backgroundColor = '#2563eb';
      });
      reportButton.addEventListener('mouseout', () => {
        reportButton.style.backgroundColor = '#3b82f6';
      });

      buttonContainer.appendChild(leaveButton);
      buttonContainer.appendChild(reportButton);

      // Footer
      const footer = document.createElement('div');
      footer.style.cssText = `
        text-align: center !important;
        font-size: 12px !important;
        color: #6b7280 !important;
        padding-top: 16px !important;
        border-top: 1px solid #e5e7eb !important;
        margin-top: 16px !important;
      `;
      footer.textContent = texts.footer;

      body.appendChild(riskBadge);
      body.appendChild(analysisText);
      body.appendChild(actionText);
      body.appendChild(ackSection);
      body.appendChild(buttonContainer);
      body.appendChild(footer);

      modal.appendChild(header);
      modal.appendChild(body);
      modalContainer.appendChild(modal);

      return modalContainer;
    }

    // Function to show website protection (blur + modal)
    function showWebsiteProtection(analysisResult: any) {
      if (isWebsiteBlurred) return; // Already protected
      
      console.log('🛡️ Showing website protection for medium/high risk');
      
      // Clean up any existing modals first (including loading states)
      cleanupAllModals();
      
      // Create and show blur overlay
      blurOverlay = createBlurOverlay();
      document.body.appendChild(blurOverlay);
      
      // Create and show warning modal
      warningModal = createWarningModal(analysisResult);
      document.body.appendChild(warningModal);
      
      isWebsiteBlurred = true;
      
      // Prevent scrolling
      document.body.style.overflow = 'hidden';
      
      // Additional cleanup after a short delay to catch any late-arriving modals
      setTimeout(() => {
        const existingModal = document.getElementById('maiscam-analysis-modal');
        if (existingModal && existingModal !== warningModal) {
          existingModal.remove();
          console.log('🗑️ Removed late-arriving analysis modal');
        }
      }, 100);
    }

    // Function to clean up all modals
    function cleanupAllModals() {
      // Remove all possible modal instances
      const modalSelectors = [
        '#maiscam-analysis-modal',
        '#maiscam-warning-modal',
        '#maiscam-blur-overlay'
      ];
      
      modalSelectors.forEach(selector => {
        const modal = document.querySelector(selector);
        if (modal) {
          modal.remove();
          console.log(`🗑️ Removed modal: ${selector}`);
        }
      });
    }

    // Function to remove website protection
    function removeWebsiteProtection() {
      console.log('🔓 Removing website protection - user acknowledged risk');
      
      if (blurOverlay) {
        blurOverlay.remove();
        blurOverlay = null;
      }
      
      if (warningModal) {
        warningModal.remove();
        warningModal = null;
      }
      
      // Clean up all modals to ensure nothing is left behind
      cleanupAllModals();
      
      isWebsiteBlurred = false;
      
      // Restore scrolling
      document.body.style.overflow = '';
    }

    console.log('Content script initialized for:', window.location.hostname);
  },
});
