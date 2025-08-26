import { useState, useEffect } from 'react';
import { analyzeEmailWithBackend, analyzeWebsiteWithBackend } from '../../utils/backendApi';

interface GmailData {
  subject: string;
  from: string;
  content: string;
  replyTo: string;
}

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
  };
}

interface FacebookPostData {
  username: string;
  caption: string;
  image?: string;
  postUrl: string;
  timestamp?: string;
}

// Language options with their display names
const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'ms', name: 'Bahasa Malaysia' },
  { code: 'zh', name: '中文 (Chinese)' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'th', name: 'ไทย (Thai)' },
  { code: 'fil', name: 'Filipino' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'jv', name: 'Basa Jawa' },
  { code: 'su', name: 'Basa Sunda' },
  { code: 'km', name: 'ខ្មែរ (Khmer)' },
  { code: 'lo', name: 'ລາວ (Lao)' },
  { code: 'my', name: 'မြန်မာ (Myanmar)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' }
];

type ScanMode = 'email' | 'website' | 'social';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<GmailData | null>(null);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  const [facebookData, setFacebookData] = useState<FacebookPostData | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('zh');
  const [scanMode, setScanMode] = useState<ScanMode>('email');
  const [facebookExtractionInProgress, setFacebookExtractionInProgress] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  // Check for ongoing Facebook extraction when popup opens
  useEffect(() => {
    const checkFacebookExtractionStatus = async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id && tabs[0].url?.includes('facebook.com')) {
          // Check if there's an ongoing extraction
          const response = await browser.tabs.sendMessage(tabs[0].id, { type: 'CHECK_FACEBOOK_EXTRACTION_STATUS' });
          if (response?.inProgress) {
            setFacebookExtractionInProgress(true);
            setLoading(true);
            setScanMode('social');
            
            // Listen for extraction completion
            pollForFacebookData(tabs[0].id);
          } else if (response?.data) {
            // Extraction completed, show the data
            setFacebookData(response.data);
            setScanMode('social');
          }
        }
      } catch (error) {
        console.error('Error checking Facebook extraction status:', error);
      }
    };

    checkFacebookExtractionStatus();
  }, []);

  // Function to poll for Facebook extraction completion
  const pollForFacebookData = async (tabId: number) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await browser.tabs.sendMessage(tabId, { type: 'CHECK_FACEBOOK_EXTRACTION_STATUS' });
        if (!response?.inProgress) {
          clearInterval(pollInterval);
          setLoading(false);
          setFacebookExtractionInProgress(false);
          
          if (response?.data) {
            setFacebookData(response.data);
          } else {
            setError('Facebook extraction was cancelled or failed.');
          }
        }
      } catch (error) {
        console.error('Error polling for Facebook data:', error);
        clearInterval(pollInterval);
        setLoading(false);
        setFacebookExtractionInProgress(false);
        setError('Lost connection to Facebook extraction.');
      }
    }, 1000); // Poll every second

    // Stop polling after 60 seconds to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
      if (facebookExtractionInProgress) {
        setLoading(false);
        setFacebookExtractionInProgress(false);
        setError('Facebook extraction timed out.');
      }
    }, 60000);
  };

  // Function to analyze email for scam - now shows modal on website
  const analyzeEmailForScam = async () => {
    setLoading(true);
    setError(null);
    // Don't clear extractedData - we want to show what we're analyzing
    setAnalysisResult(null);
    
    try {
      console.log('🚀 [ANALYZE EMAIL BUTTON] Starting email analysis...');
      
      // First, extract Gmail data from content script
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id && tabs[0].url?.includes('mail.google.com')) {
        
        // Show loading modal on website first
        await browser.tabs.sendMessage(tabs[0].id, { 
          type: 'SHOW_ANALYSIS_MODAL', 
          result: null, 
          loading: true 
        });
        
        // Get Gmail data from content script (data extraction only)
        const gmailData = await browser.tabs.sendMessage(tabs[0].id, { type: 'GET_GMAIL_DATA' });
        console.log('📧 [ANALYZE EMAIL BUTTON] Extracted Gmail data:', gmailData);
        
        if (gmailData) {
          setExtractedData(gmailData);
          
          // Now analyze using the same method as before (popup context for auth)
          console.log('🎯 [ANALYZE EMAIL BUTTON] Running analysis using analyzeEmailWithBackend function...');
          
          const backendRequest = {
            subject: gmailData.subject,
            content: gmailData.content,
            from_email: gmailData.from,
            target_language: selectedLanguage,
            reply_to_email: gmailData.replyTo !== 'None' ? gmailData.replyTo : undefined
          };
          
          console.log('📤 [ANALYZE EMAIL BUTTON] Backend request:', JSON.stringify(backendRequest, null, 2));
          
          // Call backend API directly in popup context (same as test button)
          const backendResponse = await analyzeEmailWithBackend(backendRequest, 'ANALYZE EMAIL BUTTON - POPUP CONTEXT');
          
          console.log('📥 [ANALYZE EMAIL BUTTON] Backend response:', JSON.stringify(backendResponse, null, 2));
          
          // Check if response is successful and has data
          if (backendResponse.success && backendResponse.data) {
            const analysisData = {
              risk_level: backendResponse.data.risk_level,
              analysis: backendResponse.data.reasons,
              recommended_action: backendResponse.data.recommended_action,
              detected_language: backendResponse.data.detected_language || 'unknown',
              target_language: selectedLanguage,
              target_language_name: LANGUAGE_OPTIONS.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage
            };
            
            // Show analysis result modal on website
            await browser.tabs.sendMessage(tabs[0].id, { 
              type: 'SHOW_ANALYSIS_MODAL', 
              result: analysisData, 
              loading: false 
            });
            
            console.log('✅ [ANALYZE EMAIL BUTTON] Analysis completed and modal displayed on website');
          } else {
            throw new Error(backendResponse.message || 'Analysis failed - no data received');
          }
          
        } else {
          // Show error modal on website
          await browser.tabs.sendMessage(tabs[0].id, { 
            type: 'SHOW_ANALYSIS_ERROR', 
            error: 'No email data found. Make sure you have an email open in Gmail.' 
          });
        }
      } else {
        setError('Please make sure you are on a Gmail page with an email open.');
      }
    } catch (err: any) {
      console.error('❌ [ANALYZE EMAIL BUTTON] Error analyzing email:', err);
      console.error('❌ [ANALYZE EMAIL BUTTON] Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      
      // Show error modal on website
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id && tabs[0].url?.includes('mail.google.com')) {
        let errorMessage = 'Error processing email: ';
        if (err.message?.includes('backend')) {
          errorMessage += 'Backend server connection failed. Please ensure the server is running.';
        } else if (err.message?.includes('timeout')) {
          errorMessage += 'Analysis request timed out. Please try again.';
        } else if (err.message?.includes('authentication')) {
          errorMessage += 'Authentication failed. API key may be invalid.';
        } else {
          errorMessage += (err.message || 'Unknown error');
        }
        
        await browser.tabs.sendMessage(tabs[0].id, { 
          type: 'SHOW_ANALYSIS_ERROR', 
          error: errorMessage 
        });
      } else {
        // Fallback to popup error if not on Gmail
        if (err.message?.includes('backend')) {
          setError('Backend server connection failed. Please ensure the server is running at http://localhost:8000');
        } else if (err.message?.includes('timeout')) {
          setError('Analysis request timed out. Please try again.');
        } else if (err.message?.includes('authentication')) {
          setError('Authentication failed. API key may be invalid.');
        } else {
          setError('Error processing email: ' + (err.message || 'Unknown error'));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to analyze website for scam - matches email demo pattern
  const analyzeWebsiteForScam = async () => {
    setLoading(true);
    setError(null);
    // Don't clear websiteData - we want to show what we're analyzing
    
    try {
      console.log('🌐 [ANALYZE WEBSITE BUTTON] Starting website analysis...');
      
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found.');
      }

      // Show loading modal on website immediately 
      console.log('🌐 [ANALYZE WEBSITE BUTTON] Showing loading modal on website...');
      await browser.tabs.sendMessage(tabs[0].id, { 
        type: 'SHOW_ANALYSIS_MODAL', 
        result: null, 
        loading: true 
      });

      // Get website data using DOM parsing
      console.log('🌐 [ANALYZE WEBSITE BUTTON] Extracting website data...');
      const websiteData = await browser.tabs.sendMessage(tabs[0].id, { type: 'GET_WEBSITE_DATA' });
      
      if (!websiteData) {
        throw new Error('Failed to extract website content. Please try again.');
      }

      console.log('🌐 [ANALYZE WEBSITE BUTTON] Extracted website data:', websiteData);

      // Set website data for popup display
      setWebsiteData(websiteData);

      // Prepare backend request
      const backendRequest = {
        url: websiteData.url || tabs[0].url || 'unknown',
        title: websiteData.title || '',
        content: websiteData.content || '',
        target_language: selectedLanguage,
        metadata: websiteData.metadata || {}
      };

      console.log('📤 [ANALYZE WEBSITE BUTTON] Sending to backend:', JSON.stringify(backendRequest, null, 2));

      // Call backend API
      const backendResponse = await analyzeWebsiteWithBackend(backendRequest, 'ANALYZE WEBSITE BUTTON - POPUP CONTEXT');
      
      console.log('📥 [ANALYZE WEBSITE BUTTON] Backend response:', JSON.stringify(backendResponse, null, 2));
      
      // Check if response is successful and has data
      if (backendResponse.success && backendResponse.data) {
        const analysisData = {
          risk_level: backendResponse.data.risk_level,
          analysis: backendResponse.data.reasons,
          recommended_action: backendResponse.data.recommended_action,
          detected_language: backendResponse.data.detected_language || 'unknown',
          target_language: selectedLanguage,
          target_language_name: LANGUAGE_OPTIONS.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage
        };
        
        // Show analysis result modal on website
        await browser.tabs.sendMessage(tabs[0].id, { 
          type: 'SHOW_ANALYSIS_MODAL', 
          result: analysisData, 
          loading: false 
        });
        
        console.log('✅ [ANALYZE WEBSITE BUTTON] Analysis completed and modal displayed on website');
      } else {
        throw new Error(backendResponse.message || 'Analysis failed - no data received');
      }
      
    } catch (err: any) {
      console.error('❌ [ANALYZE WEBSITE BUTTON] Error:', err);
      
      try {
        // Show error modal on website
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          await browser.tabs.sendMessage(tabs[0].id, { 
            type: 'SHOW_ANALYSIS_ERROR', 
            error: err.message || 'Analysis failed' 
          });
        }
      } catch (modalError) {
        console.error('Failed to show error modal:', modalError);
        // Fallback to popup error display
        let errorMessage = 'Website analysis failed: ';
        if (err.message?.includes('Backend server is not responding')) {
          errorMessage += 'Cannot connect to analysis server. Please ensure the backend server is running.';
        } else if (err.message?.includes('timed out')) {
          errorMessage += 'Request timed out. Please try again.';
        } else {
          errorMessage += (err.message || 'Unknown error');
        }
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to scan Facebook post
  const scanFacebookPost = async () => {
    // Check if extraction is already in progress
    if (facebookExtractionInProgress) {
      setError('Facebook extraction is already in progress. Please wait or cancel the current extraction.');
      return;
    }

    setLoading(true);
    setError(null);
    setFacebookData(null);
    setFacebookExtractionInProgress(true);
    
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        // Check if we're on Facebook
        if (!tabs[0].url?.includes('facebook.com')) {
          setError('Please navigate to Facebook to use this feature.');
          return;
        }

        // Start Facebook post extraction (this will show the overlay and wait for user selection)
        // The extraction will continue even if the popup closes
        await browser.tabs.sendMessage(tabs[0].id, { type: 'START_FACEBOOK_EXTRACTION' });
        console.log('Facebook extraction started - popup can now be closed');
        
        // Start polling for completion
        pollForFacebookData(tabs[0].id);
        
      } else {
        setError('No active tab found.');
      }
    } catch (err: any) {
      console.error('Error starting Facebook extraction:', err);
      setError('Error starting Facebook extraction. Please try again.');
      setFacebookExtractionInProgress(false);
      setLoading(false);
    }
  };


  return (
    <div className="w-96 min-h-96 p-4 bg-white">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800 mb-3">mAIscam Extension</h1>
        <div className="space-y-3">
          {/* Scan Mode Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔍 Scan Mode
            </label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setScanMode('email')}
                disabled={loading}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  scanMode === 'email'
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                } disabled:cursor-not-allowed`}
              >
                📧 Email
              </button>
              <button
                onClick={() => setScanMode('website')}
                disabled={loading}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  scanMode === 'website'
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                } disabled:cursor-not-allowed`}
              >
                🌐 Website
              </button>
              <button
                onClick={() => setScanMode('social')}
                disabled={loading}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  scanMode === 'social'
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                } disabled:cursor-not-allowed`}
              >
                📱 Social
              </button>
            </div>
          </div>

          {/* Language Selector - show for email and website scanning */}
          {(scanMode === 'email' || scanMode === 'website') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🌐 Analysis Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={
                scanMode === 'email' ? analyzeEmailForScam : 
                scanMode === 'website' ? analyzeWebsiteForScam : 
                scanFacebookPost
              }
              disabled={loading}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading 
                ? (scanMode === 'email' ? 'Analyzing Email...' : 
                   scanMode === 'website' ? 'Analyzing Website...' : 
                   facebookExtractionInProgress ? 'Waiting for Post Selection...' : 'Starting Facebook Extraction...') 
                : (scanMode === 'email' ? '🛡️ Analyze Email' : 
                   scanMode === 'website' ? '🛡️ Analyze Website' : 
                   '📱 Scan Facebook Post')
              }
            </button>
            
            {(extractedData || websiteData || facebookData) && (
              <button
                onClick={() => {
                  setExtractedData(null);
                  setWebsiteData(null);
                  setFacebookData(null);
                  setFacebookExtractionInProgress(false);
                  setError(null);
                }}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm"
              >
                🔄 Clear Results
              </button>
            )}
            
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}


      {facebookExtractionInProgress && !facebookData && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            <span className="font-semibold">Facebook Extraction in Progress</span>
          </div>
          <p className="text-sm">
            Please go to the Facebook tab and select a post. You can close this popup - we'll remember your selection!
          </p>
        </div>
      )}

      {extractedData ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600">✅</span>
              <h3 className="font-semibold text-green-800">Email Content Extracted</h3>
            </div>
            <p className="text-xs text-green-600">
              Content extracted and analyzed using backend API in{' '}
              <span className="font-medium">
                {LANGUAGE_OPTIONS.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage}
              </span>
              <br />
              <span className="text-gray-500 mt-1">Analysis results displayed in modal on the website!</span>
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">📧 Subject</h4>
              <p className="text-sm text-gray-600 break-words">{extractedData.subject}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">👤 From</h4>
              <p className="text-sm text-gray-600 break-words">{extractedData.from}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">📧 Reply-To</h4>
              <p className="text-sm text-gray-600 break-words">{extractedData.replyTo}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">📄 Content Preview</h4>
              <div className="text-sm text-gray-600 max-h-32 overflow-y-auto break-words bg-white p-2 rounded border">
                <pre className="whitespace-pre-wrap font-sans text-xs">
                  {extractedData.content.length > 300 
                    ? extractedData.content.substring(0, 300) + '...' 
                    : extractedData.content}
                </pre>
              </div>
              {extractedData.content.length > 300 && (
                <p className="text-xs text-gray-500 mt-1">Content truncated for display</p>
              )}
            </div>
          </div>
        </div>
      ) : null}


      {websiteData ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-600">✅</span>
              <h3 className="font-semibold text-blue-800">Website Content Extracted</h3>
            </div>
            <p className="text-xs text-blue-600">
              Content extracted and analyzed using backend API in{' '}
              <span className="font-medium">
                {LANGUAGE_OPTIONS.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage}
              </span>
              <br />
              <span className="text-gray-500 mt-1">Analysis results displayed in modal on the website!</span>
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">🔗 URL</h4>
              <p className="text-sm text-gray-600 break-all">{websiteData.url}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">📝 Title</h4>
              <p className="text-sm text-gray-600 break-words">{websiteData.title}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">🌐 Domain</h4>
              <p className="text-sm text-gray-600">{websiteData.metadata.domain}</p>
            </div>

            {websiteData.metadata.description && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-semibold text-gray-700 mb-2 text-sm">📄 Description</h4>
                <p className="text-sm text-gray-600 break-words">{websiteData.metadata.description}</p>
              </div>
            )}

            {websiteData.metadata.keywords && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-semibold text-gray-700 mb-2 text-sm">🏷️ Keywords</h4>
                <p className="text-sm text-gray-600 break-words">{websiteData.metadata.keywords}</p>
              </div>
            )}

            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">📄 Page Content</h4>
              <div className="text-sm text-gray-600 max-h-32 overflow-y-auto break-words bg-white p-2 rounded border">
                <pre className="whitespace-pre-wrap font-sans text-xs">
                  {websiteData.content.length > 400 
                    ? websiteData.content.substring(0, 400) + '...' 
                    : websiteData.content}
                </pre>
              </div>
              {websiteData.content.length > 400 && (
                <p className="text-xs text-gray-500 mt-1">Content truncated for display</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {facebookData ? (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-purple-600">✅</span>
              <h3 className="font-semibold text-purple-800">Facebook Post Data Extracted</h3>
            </div>
            <p className="text-xs text-purple-600">
              Facebook post information successfully captured
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">👤 Username</h4>
              <p className="text-sm text-gray-600 break-words">{facebookData.username}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">📝 Caption</h4>
              <div className="text-sm text-gray-600 max-h-32 overflow-y-auto break-words bg-white p-2 rounded border">
                <pre className="whitespace-pre-wrap font-sans text-xs">
                  {facebookData.caption.length > 300 
                    ? facebookData.caption.substring(0, 300) + '...' 
                    : facebookData.caption}
                </pre>
              </div>
              {facebookData.caption.length > 300 && (
                <p className="text-xs text-gray-500 mt-1">Caption truncated for display</p>
              )}
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">🔗 Post URL</h4>
              <p className="text-sm text-gray-600 break-all">{facebookData.postUrl}</p>
            </div>

            {facebookData.timestamp && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-semibold text-gray-700 mb-2 text-sm">⏰ Timestamp</h4>
                <p className="text-sm text-gray-600">{facebookData.timestamp}</p>
              </div>
            )}

            {facebookData.image && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-semibold text-gray-700 mb-2 text-sm">🖼️ Post Image</h4>
                <img 
                  src={facebookData.image} 
                  alt="Facebook post image" 
                  className="w-full rounded border max-h-64 object-cover"
                />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!loading && !error && !extractedData && !websiteData && !facebookData && (
        <div className="text-center text-gray-500 py-12">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <p className="text-sm font-medium">
            {scanMode === 'email' ? 'Ready to analyze emails' : 
             scanMode === 'website' ? 'Ready to scan websites' : 
             'Ready to scan Facebook posts'}
          </p>
          <p className="text-xs mt-2 text-gray-400">
            {scanMode === 'email' 
              ? 'Open an email in Gmail and click "Analyze Email" to check for threats'
              : scanMode === 'website'
              ? 'Navigate to any website and click "Scan Website" to extract information'
              : 'Navigate to Facebook and click "Scan Facebook Post" to extract post data'
            }
          </p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          {scanMode === 'email' 
            ? 'Make sure you\'re on Gmail with an email open'
            : scanMode === 'website'
            ? 'Works on any website - just click scan to extract information'
            : 'Make sure you\'re on Facebook viewing posts'
          }
        </p>
      </div>


    </div>
  );
}

export default App;
