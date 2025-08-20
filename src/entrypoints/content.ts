import { analyzeEmail, AnalysisRequest, AnalysisResponse } from '../utils/mockApi';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  main() {
    console.log('Content script loaded on:', window.location.hostname);
    
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
      }
    });

    console.log('Content script initialized for:', window.location.hostname);
  },
});
