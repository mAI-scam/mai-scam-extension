import { useState } from 'react';

interface GmailData {
  subject: string;
  from: string;
  content: string;
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

  // Function to analyze email for scam - extract data and trigger content script modal
  const analyzeEmailForScam = async () => {
    setLoading(true);
    setError(null);
    setExtractedData(null);
    
    try {
      // First, extract Gmail data to show in popup
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id && tabs[0].url?.includes('mail.google.com')) {
        // Get Gmail data
        const gmailData = await browser.tabs.sendMessage(tabs[0].id, { type: 'GET_GMAIL_DATA' });
        console.log('Extracted Gmail data:', gmailData);
        
        if (gmailData) {
          setExtractedData(gmailData);
          
          // Then send message to content script to analyze and show modal
          await browser.tabs.sendMessage(tabs[0].id, { 
            type: 'ANALYZE_EMAIL', 
            targetLanguage: selectedLanguage 
          });
          console.log('Analysis request sent to content script');
        } else {
          setError('No email data found. Make sure you have an email open in Gmail.');
        }
      } else {
        setError('Please make sure you are on a Gmail page with an email open.');
      }
    } catch (err) {
      console.error('Error processing email:', err);
      setError('Error processing email. Make sure you are on Gmail with an email open.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-96 min-h-96 p-4 bg-white">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800 mb-3">mAIscam Extension</h1>
        <div className="space-y-3">
          {/* Language Selector */}
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

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={analyzeEmailForScam}
              disabled={loading}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Analyzing...' : '🛡️ Analyze for Scam'}
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
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <p className="text-sm">{error}</p>
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
              Content extracted and analysis initiated in{' '}
              <span className="font-medium">
                {LANGUAGE_OPTIONS.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage}
              </span>
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
      ) : !loading && !error && (
        <div className="text-center text-gray-500 py-12">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <p className="text-sm font-medium">Ready to analyze emails</p>
          <p className="text-xs mt-2 text-gray-400">
            Open an email in Gmail and click "Analyze for Scam" to check for threats
          </p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          Make sure you're on Gmail with an email open
        </p>
      </div>


    </div>
  );
}

export default App;
