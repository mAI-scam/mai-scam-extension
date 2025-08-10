export default defineContentScript({
  matches: ['*://mail.google.com/*'],
  main() {
    console.log('Gmail scraper content script loaded');
    
    // Interface for Gmail data
    interface GmailData {
      subject: string;
      from: string;
      content: string;
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

    // Listen for messages from popup requesting data
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_GMAIL_DATA') {
        const gmailData = extractGmailData();
        console.log('Manual Gmail data extraction requested:', gmailData);
        sendResponse(gmailData);
      }
    });

    console.log('Gmail content script initialized');
  },
});
