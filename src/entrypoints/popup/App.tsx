import { useState } from 'react';

interface GmailData {
  subject: string;
  from: string;
  content: string;
}

function App() {
  const [gmailData, setGmailData] = useState<GmailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to extract Gmail data
  const extractGmailData = async () => {
    setLoading(true);
    setError(null);
    setGmailData(null); // Clear previous data
    
    try {
      // Send message to background script to get Gmail data
      const response = await browser.runtime.sendMessage({ type: 'GET_GMAIL_DATA' });
      console.log('Popup received Gmail data:', response);
      
      if (response) {
        setGmailData(response);
      } else {
        setError('No Gmail data found. Make sure you are on a Gmail page with an open email.');
      }
    } catch (err) {
      console.error('Error fetching Gmail data:', err);
      setError('Error fetching Gmail data. Make sure you are on Gmail.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-96 min-h-96 p-4 bg-white">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800 mb-3">Gmail Email Scraper</h1>
        <button
          onClick={extractGmailData}
          disabled={loading}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? 'Extracting...' : '📧 Extract Gmail'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {gmailData ? (
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">📧 Subject</h3>
            <p className="text-sm text-gray-600 break-words">{gmailData.subject}</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">👤 From</h3>
            <p className="text-sm text-gray-600 break-words">{gmailData.from}</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">📄 Content</h3>
            <div className="text-sm text-gray-600 max-h-64 overflow-y-auto break-words bg-white p-3 rounded border">
              <pre className="whitespace-pre-wrap font-sans">{gmailData.content}</pre>
            </div>
          </div>
        </div>
      ) : !loading && !error && (
        <div className="text-center text-gray-500 py-12">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium">No Gmail data extracted yet</p>
          <p className="text-xs mt-2 text-gray-400">
            Open an email in Gmail and click "Extract Gmail" to get started
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
