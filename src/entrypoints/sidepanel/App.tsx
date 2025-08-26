import { useState, useEffect } from 'react';
import { analyzeEmailWithBackend } from '../../utils/backendApi';

interface GmailData {
  subject: string;
  from: string;
  content: string;
  replyTo: string;
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

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<GmailData | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('zh');

  // Function to analyze email for scam - identical to popup functionality
  const analyzeEmailForScam = async () => {
    setLoading(true);
    setError(null);
    // Don't clear extractedData - we want to show what we're analyzing
    
    try {
      console.log('🚀 [SIDEBAR - ANALYZE EMAIL] Starting email analysis...');
      
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
        console.log('📧 [SIDEBAR - ANALYZE EMAIL] Extracted Gmail data:', gmailData);
        
        if (gmailData) {
          setExtractedData(gmailData);
          
          // Now analyze using the same method as before (sidebar context for auth)
          console.log('🎯 [SIDEBAR - ANALYZE EMAIL] Running analysis using analyzeEmailWithBackend function...');
          
          const backendRequest = {
            subject: gmailData.subject,
            content: gmailData.content,
            from_email: gmailData.from,
            target_language: selectedLanguage,
            reply_to_email: gmailData.replyTo !== 'None' ? gmailData.replyTo : undefined
          };
          
          console.log('📤 [SIDEBAR - ANALYZE EMAIL] Backend request:', JSON.stringify(backendRequest, null, 2));
          
          // Call backend API v2 directly in sidebar context (using SEA-LION v4)
          const backendResponse = await analyzeEmailWithBackend(backendRequest, 'ANALYZE EMAIL BUTTON - SIDEBAR V2 CONTEXT');
          
          console.log('📥 [SIDEBAR - ANALYZE EMAIL] Backend response:', JSON.stringify(backendResponse, null, 2));
          
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
            
            console.log('✅ [SIDEBAR - ANALYZE EMAIL] Analysis completed and modal displayed on website');
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
      console.error('❌ [SIDEBAR - ANALYZE EMAIL] Error analyzing email:', err);
      console.error('❌ [SIDEBAR - ANALYZE EMAIL] Error details:', {
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
        // Fallback to sidebar error if not on Gmail
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

  return (
    <div className="w-full h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-800 mb-2">mAIscam Extension</h1>
        <p className="text-sm text-gray-600">📧 Email Analysis Mode (v2 - SEA-LION v4)</p>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {/* Language Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🌐 Analysis Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm bg-white"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action Button */}
          <div className="space-y-2">
            <button
              onClick={analyzeEmailForScam}
              disabled={loading}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Analyzing Email...' : '🛡️ Analyze Email'}
            </button>
            
            {extractedData && (
              <button
                onClick={() => {
                  setExtractedData(null);
                  setError(null);
                }}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm"
              >
                🔄 Clear Results
              </button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Extracted Email Data Display */}
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
                <div className="bg-white p-3 rounded-lg shadow-sm border">
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">📧 Subject</h4>
                  <p className="text-sm text-gray-600 break-words">{extractedData.subject}</p>
                </div>

                <div className="bg-white p-3 rounded-lg shadow-sm border">
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">👤 From</h4>
                  <p className="text-sm text-gray-600 break-words">{extractedData.from}</p>
                </div>

                <div className="bg-white p-3 rounded-lg shadow-sm border">
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">📧 Reply-To</h4>
                  <p className="text-sm text-gray-600 break-words">{extractedData.replyTo}</p>
                </div>

                <div className="bg-white p-3 rounded-lg shadow-sm border">
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">📄 Content Preview</h4>
                  <div className="text-sm text-gray-600 max-h-32 overflow-y-auto break-words bg-gray-50 p-2 rounded border">
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
          ) : (
            !loading && !error && (
              <div className="text-center text-gray-500 py-8">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <p className="text-sm font-medium mb-2">Ready to analyze emails</p>
                <p className="text-xs text-gray-400">
                  Open an email in Gmail and click "Analyze Email" to check for threats
                </p>
              </div>
            )
          )}

          {/* Footer Instructions */}
          <div className="pt-4 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">
              Make sure you're on Gmail with an email open
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
