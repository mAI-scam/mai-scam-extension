// Real Backend API for scam analysis
export interface BackendAnalysisRequest {
  subject: string;
  content: string;
  from_email: string;
  target_language: string;
  reply_to_email?: string;
}

export interface WebsiteAnalysisRequest {
  url: string;
  title?: string;
  content?: string;
  target_language: string;
  screenshot_data?: string;
  metadata?: any;
}

export interface SocialMediaAnalysisRequest {
  platform: string;
  content: string;
  author_username: string;
  target_language: string;
  image?: string;
  post_url?: string;
  author_followers_count?: number;
  engagement_metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    reactions?: number;
    views?: number;
  };
}

export interface BackendAnalysisResult {
  risk_level: string;
  reasons: string;
  recommended_action: string;
  detected_language?: string;
}

export interface BackendAnalysisResponse {
  success: boolean;
  message: string;
  data: BackendAnalysisResult;
  timestamp: string;
  status_code: number;
}

// Backend API configuration
const BACKEND_CONFIG = {
  // Use deployed API as primary, localhost as fallback
  baseUrl: 'http://localhost:8000',
  fallbackUrls: [
    'https://mai-scam-backend-uat.onrender.com',
    'http://127.0.0.1:8000'
  ],
  endpoints: {
    emailAnalyze: '/email/v2/analyze',
    websiteAnalyze: '/website/v2/analyze',
    socialMediaAnalyze: '/socialmedia/v2/analyze',
    health: '/email/',
    createApiKey: '/auth/api-key',
    createToken: '/auth/token'
  },
  timeout: 30000, // 30 seconds timeout
  
  // Authentication configuration for web extension
  authConfig: {
    clientId: 'mai_scam_extension_v1',
    clientType: 'web_extension'
  }
};

// Error classes for better error handling
export class BackendApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

export class BackendConnectionError extends BackendApiError {
  constructor(message: string = 'Failed to connect to backend server') {
    super(message, 0, 'CONNECTION_ERROR');
    this.name = 'BackendConnectionError';
  }
}

export class BackendTimeoutError extends BackendApiError {
  constructor(message: string = 'Request timeout') {
    super(message, 0, 'TIMEOUT_ERROR');
    this.name = 'BackendTimeoutError';
  }
}

// Real backend API call for email analysis
export async function analyzeEmailWithBackend(request: BackendAnalysisRequest, caller?: string): Promise<BackendAnalysisResponse> {
  const url = `${BACKEND_CONFIG.baseUrl}${BACKEND_CONFIG.endpoints.emailAnalyze}`;
  const callerInfo = caller ? `[${caller}] ` : '';
  
  console.log(`📡 ${callerInfo}Making authenticated POST request to:`, url);
  console.log(`📤 ${callerInfo}POST request payload:`, JSON.stringify(request, null, 2));
  
  // Get API key for authentication
  let apiKey: string;
  try {
    console.log(`🔐 ${callerInfo}Getting API key for authentication...`);
    apiKey = await getOrCreateApiKey();
    console.log(`✅ ${callerInfo}API key obtained successfully for request`);
  } catch (error: any) {
    console.error('❌ Failed to get API key:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new BackendApiError(`Failed to get API key for authentication: ${errorMessage}`, 401);
  }
  
  // Prepare request with authentication headers
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': apiKey, // Add API key for authentication
    },
    body: JSON.stringify(request)
  };
  
  console.log(`📋 ${callerInfo}POST request options (API key redacted):`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': '[REDACTED]'
    },
    body: '[JSON payload]'
  });

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.timeout);

  try {
    const response = await fetch(url, {
      ...requestOptions,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log('📥 POST Response status:', response.status);
    console.log('📥 POST Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails: any = null;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
        errorDetails = errorData;
      } catch (e) {
        // If response body is not JSON, use status text
      }

      throw new BackendApiError(
        errorMessage,
        response.status,
        response.status >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR',
        errorDetails
      );
    }

    const data = await response.json();
    console.log('✅ Backend API response:', JSON.stringify(data, null, 2));
    console.log('📋 Response data structure:', {
      success: data.success,
      dataKeys: data.data ? Object.keys(data.data) : 'no data',
      dataType: typeof data.data
    });

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new BackendApiError('Invalid response format from backend', 502, 'INVALID_RESPONSE');
    }

    if (!data.success) {
      throw new BackendApiError(
        data.message || 'Backend analysis failed',
        data.status_code || 500,
        'ANALYSIS_FAILED',
        data
      );
    }

    if (!data.data) {
      throw new BackendApiError('Missing analysis data in response', 502, 'MISSING_DATA');
    }

    return data as BackendAnalysisResponse;

  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏰ Backend API request timed out');
      throw new BackendTimeoutError();
    }

    if (error instanceof BackendApiError) {
      console.error('❌ Backend API error:', error.message, error);
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('🔌 Backend connection error:', error.message);
      throw new BackendConnectionError('Unable to connect to backend server. Please check if the server is running.');
    }

    console.error('💥 Unexpected error during backend API call:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    throw new BackendApiError(
      errorMessage,
      500,
      'UNEXPECTED_ERROR',
      error
    );
  }
}

// Utility function to check backend health with multiple URL attempts
export async function checkBackendHealth(): Promise<{isHealthy: boolean, workingUrl: string | null, error?: string}> {
  const urlsToTry = [BACKEND_CONFIG.baseUrl, ...BACKEND_CONFIG.fallbackUrls];
  
  for (const baseUrl of urlsToTry) {
    let timeoutId: NodeJS.Timeout | undefined;
    
    try {
      console.log(`🏥 Trying health check at: ${baseUrl}${BACKEND_CONFIG.endpoints.health}`);
      
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check
      
      const response = await fetch(`${baseUrl}${BACKEND_CONFIG.endpoints.health}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`📡 Health check response from ${baseUrl}:`, response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Backend healthy at ${baseUrl}:`, data);
        
        // Update the working URL for future requests
        BACKEND_CONFIG.baseUrl = baseUrl;
        
        return {
          isHealthy: true,
          workingUrl: baseUrl
        };
      } else {
        console.log(`❌ Backend not healthy at ${baseUrl}: ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      if (typeof timeoutId !== 'undefined') {
        clearTimeout(timeoutId);
      }
      
      if (error.name === 'AbortError') {
        console.log(`⏰ Health check timeout at ${baseUrl}`);
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log(`🔌 Connection failed to ${baseUrl}:`, error.message);
      } else {
        console.log(`💥 Health check error at ${baseUrl}:`, error);
      }
    }
  }
  
  return {
    isHealthy: false,
    workingUrl: null,
    error: `Failed to connect to backend server at any of these URLs: ${urlsToTry.join(', ')}`
  };
}

// Convert old mock API request format to new backend format
export function convertToBackendRequest(
  title: string,
  content: string,
  from_email: string,
  target_language: string,
  reply_to_email?: string
): BackendAnalysisRequest {
  return {
    subject: title, // Convert 'title' to 'subject'
    content,
    from_email,
    target_language,
    reply_to_email: reply_to_email || undefined
  };
}

// Convert backend response to match existing popup expectations
export function convertBackendResponseToMockFormat(
  backendResponse: BackendAnalysisResponse,
  target_language: string
): any {
  return {
    code: backendResponse.status_code,
    message: backendResponse.message,
    success: backendResponse.success,
    data: {
      email_id: 'backend_analysis', // Backend doesn't return email_id in this format
      [target_language]: {
        risk_level: backendResponse.data.risk_level,
        analysis: backendResponse.data.reasons, // Map 'reasons' to 'analysis'
        recommended_action: backendResponse.data.recommended_action
      }
    }
  };
}

// Authentication management - now using persistent storage
const API_KEY_STORAGE_KEY = 'mai_scam_api_key';
const API_KEY_CREATED_KEY = 'mai_scam_api_key_created';
const API_KEY_EXPIRY_DAYS = 30; // API keys expire after 30 days

// Function to get stored API key
async function getStoredApiKey(): Promise<{apiKey: string | null, createdAt: number | null}> {
  try {
    const result = await browser.storage.local.get([API_KEY_STORAGE_KEY, API_KEY_CREATED_KEY]);
    return {
      apiKey: result[API_KEY_STORAGE_KEY] || null,
      createdAt: result[API_KEY_CREATED_KEY] || null
    };
  } catch (error: any) {
    console.warn('Failed to get stored API key:', error);
    return { apiKey: null, createdAt: null };
  }
}

// Function to store API key
async function storeApiKey(apiKey: string): Promise<void> {
  try {
    const now = Date.now();
    await browser.storage.local.set({
      [API_KEY_STORAGE_KEY]: apiKey,
      [API_KEY_CREATED_KEY]: now
    });
    console.log('✅ API key stored persistently');
  } catch (error: any) {
    console.warn('Failed to store API key:', error);
  }
}

// Function to check if API key is expired
function isApiKeyExpired(createdAt: number): boolean {
  if (!createdAt) return true;
  const now = Date.now();
  const daysSinceCreated = (now - createdAt) / (1000 * 60 * 60 * 24);
  return daysSinceCreated > API_KEY_EXPIRY_DAYS;
}

// Function to create and cache an API key with persistent storage
export async function getOrCreateApiKey(): Promise<string> {
  console.log('🔑 Getting or creating API key...');
  
  // Check for stored API key first
  const { apiKey: storedApiKey, createdAt } = await getStoredApiKey();
  
  if (storedApiKey && createdAt && !isApiKeyExpired(createdAt)) {
    console.log('✅ Using stored API key (not expired)');
    return storedApiKey;
  }
  
  if (storedApiKey && createdAt && isApiKeyExpired(createdAt)) {
    console.log('⚠️ Stored API key expired, creating new one');
    await clearStoredApiKey();
  }

  const url = `${BACKEND_CONFIG.baseUrl}${BACKEND_CONFIG.endpoints.createApiKey}`;
  
  console.log('🔑 Creating API key for web extension...');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: BACKEND_CONFIG.authConfig.clientId,
        client_type: BACKEND_CONFIG.authConfig.clientType,
        description: 'Auto-generated API key for mAIscam browser extension'
      })
    });

    if (!response.ok) {
      throw new BackendApiError(`Failed to create API key: ${response.status} ${response.statusText}`, response.status);
    }

    const data = await response.json();
    
    if (data.success && data.data && data.data.api_key) {
      const newApiKey = data.data.api_key;
      
      // Store the new API key persistently
      await storeApiKey(newApiKey);
      
      console.log('✅ API key created and stored successfully');
      return newApiKey;
    } else {
      throw new BackendApiError('Invalid API key creation response', 500);
    }
  } catch (error: any) {
    console.error('❌ Failed to create API key:', error);
    if (error instanceof BackendApiError) {
      throw error;
    }
    throw new BackendApiError('Failed to create API key: ' + error.message, 500);
  }
}

// Function to clear stored API key
async function clearStoredApiKey(): Promise<void> {
  try {
    await browser.storage.local.remove([API_KEY_STORAGE_KEY, API_KEY_CREATED_KEY]);
    console.log('🗑️ Stored API key cleared');
  } catch (error: any) {
    console.warn('Failed to clear stored API key:', error);
  }
}

// Function to clear cached API key (for testing) - now clears persistent storage too
export async function clearCachedApiKey(): Promise<void> {
  await clearStoredApiKey();
  console.log('🗑️ API key cleared from persistent storage');
}

// Debug function to test OPTIONS preflight request
export async function testOptionsRequest(): Promise<string> {
  const testUrl = `${BACKEND_CONFIG.baseUrl}${BACKEND_CONFIG.endpoints.emailAnalyze}`;
  
  try {
    console.log(`🧪 Testing OPTIONS request to: ${testUrl}`);
    
    const response = await fetch(testUrl, {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Accept',
      }
    });
    
    console.log('📥 OPTIONS Response status:', response.status);
    console.log('📥 OPTIONS Response headers:', Object.fromEntries(response.headers.entries()));
    
    return `OPTIONS ${testUrl}: ${response.status} ${response.statusText}`;
    
  } catch (error: any) {
    console.error('❌ OPTIONS Request Error:', error);
    return `OPTIONS Error: ${error.message}`;
  }
}

// Debug function to test simple connectivity
export async function testBackendConnection(): Promise<string> {
  const urlsToTest = [
    'http://localhost:8000/email/',
    'http://127.0.0.1:8000/email/',
    'http://0.0.0.0:8000/email/'
  ];
  
  let results = [];
  
  for (const url of urlsToTest) {
    try {
      console.log(`🧪 Testing connection to: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        mode: 'cors' // Explicitly set CORS mode
      });
      
      const statusText = `${url}: ${response.status} ${response.statusText}`;
      console.log(`✅ Success: ${statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        results.push(`✅ ${statusText} - Data: ${JSON.stringify(data)}`);
      } else {
        results.push(`⚠️ ${statusText}`);
      }
      
    } catch (error: any) {
      const errorText = `${url}: ${error.name} - ${error.message}`;
      console.log(`❌ Error: ${errorText}`);
      results.push(`❌ ${errorText}`);
    }
  }
  
  return results.join('\n');
}

// Test API key creation
export async function testApiKeyCreation(): Promise<string> {
  try {
    // Clear any existing cached key for testing
    await clearCachedApiKey();
    
    console.log('🧪 Testing API key creation...');
    
    const apiKey = await getOrCreateApiKey();
    
    return `✅ API key created successfully!\nKey: ${apiKey.substring(0, 20)}... (truncated for security)`;
    
  } catch (error: any) {
    console.error('❌ API key creation test failed:', error);
    return `❌ API key creation failed: ${error.message}`;
  }
}

// Function to get API key status for debugging
export async function getApiKeyStatus(): Promise<string> {
  try {
    const { apiKey, createdAt } = await getStoredApiKey();
    
    if (!apiKey) {
      return '❌ No API key stored';
    }
    
    const createdDate = createdAt ? new Date(createdAt).toLocaleString() : 'Unknown';
    const isExpired = createdAt ? isApiKeyExpired(createdAt) : true;
    const daysOld = createdAt ? Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)) : 0;
    
    return `✅ API key found
Created: ${createdDate}
Age: ${daysOld} days old
Status: ${isExpired ? '⚠️ EXPIRED' : '✅ VALID'}
Key: ${apiKey.substring(0, 20)}... (truncated)`;
    
  } catch (error: any) {
    return `❌ Error checking API key status: ${error.message}`;
  }
}

// Test the actual analyze endpoint with sample data
export async function testAnalyzeEndpoint(): Promise<string> {
  try {
    const sampleRequest: BackendAnalysisRequest = {
      subject: "Test Email Subject",
      content: "This is a test email content for debugging purposes.",
      from_email: "test@example.com",
      target_language: "en",
      reply_to_email: "reply@example.com"
    };

    console.log('🧪 [TEST ANALYZE BUTTON] Testing analyze endpoint with authentication and sample data...');
    console.log('📤 [TEST ANALYZE BUTTON] Sample request:', JSON.stringify(sampleRequest, null, 2));

    const response = await analyzeEmailWithBackend(sampleRequest, 'TEST ANALYZE BUTTON');
    
    return `✅ Analyze endpoint test successful!\nResponse: ${JSON.stringify(response, null, 2)}`;

  } catch (error: any) {
    console.error('❌ [TEST ANALYZE BUTTON] Analyze endpoint test failed:', error);
    console.error('❌ [TEST ANALYZE BUTTON] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return `❌ Analyze endpoint test failed: ${error.message}`;
  }
}

// Main function that replaces the old analyzeEmail function
export async function analyzeEmail(
  title: string,
  content: string,
  from_email: string,
  target_language: string,
  reply_to_email?: string
): Promise<any> {
  try {
    console.log('🎯 analyzeEmail function called - will make POST request');
    
    // First check if backend is healthy
    console.log('🏥 Checking backend health...');
    const healthResult = await checkBackendHealth();
    if (!healthResult.isHealthy) {
      throw new BackendConnectionError(healthResult.error || 'Backend server is not responding');
    }
    
    console.log(`✅ Using backend at: ${healthResult.workingUrl}`);

    // Convert request format
    const backendRequest = convertToBackendRequest(title, content, from_email, target_language, reply_to_email);
    
    console.log('📬 About to make authenticated POST request to /email/v1/analyze');
    console.log('📋 Request payload:', JSON.stringify(backendRequest, null, 2));
    
    // Make the backend API call
    const backendResponse = await analyzeEmailWithBackend(backendRequest, 'ANALYZE EMAIL BUTTON');
    
    console.log('✅ POST request completed successfully');
    
    // Convert response to match existing popup format
    const mockFormatResponse = convertBackendResponseToMockFormat(backendResponse, target_language);
    
    console.log('🎯 Final response for popup:', JSON.stringify(mockFormatResponse, null, 2));
    
    return mockFormatResponse;

  } catch (error: any) {
    console.error('❌ Error in analyzeEmail:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Re-throw with better error messages for the UI
    if (error instanceof BackendConnectionError) {
      console.error('❌ Backend connection error in analyzeEmail');
      throw new Error('Cannot connect to analysis server. Please ensure the backend server is running at http://localhost:8000');
    } else if (error instanceof BackendTimeoutError) {
      console.error('❌ Backend timeout error in analyzeEmail');
      throw new Error('Analysis request timed out. Please try again.');
    } else if (error instanceof BackendApiError) {
      console.error('❌ Backend API error in analyzeEmail:', error.statusCode, error.errorCode);
      throw new Error(`Analysis failed: ${error.message}`);
    } else {
      console.error('❌ Unexpected error in analyzeEmail');
      throw new Error('An unexpected error occurred during analysis. Please try again.');
    }
  }
}

// Social media analysis with backend API
export async function analyzeSocialMediaWithBackend(
  socialMediaRequest: SocialMediaAnalysisRequest,
  debugContext: string = 'SOCIAL_MEDIA_ANALYSIS'
): Promise<BackendAnalysisResponse> {
  console.log(`📱 [${debugContext}] Starting social media analysis with backend API...`);
  console.log(`📱 [${debugContext}] Social media request:`, JSON.stringify(socialMediaRequest, null, 2));
  
  const apiKey = await getOrCreateApiKey();
  
  if (!apiKey) {
    throw new BackendApiError('Failed to obtain API key for social media analysis', 401, 'AUTHENTICATION_ERROR');
  }

  const healthResult = await checkBackendHealth();
  if (!healthResult.isHealthy || !healthResult.workingUrl) {
    throw new BackendConnectionError(`Backend server is not responding. ${healthResult.error}`);
  }

  const requestUrl = `${healthResult.workingUrl}${BACKEND_CONFIG.endpoints.socialMediaAnalyze}`;
  console.log(`📱 [${debugContext}] Making request to:`, requestUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`⏰ [${debugContext}] Request timeout after ${BACKEND_CONFIG.timeout}ms`);
    controller.abort();
  }, BACKEND_CONFIG.timeout);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(socialMediaRequest),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log(`📱 [${debugContext}] Response status:`, response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${debugContext}] Backend error response:`, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      throw new BackendApiError(
        errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData.error_code || 'BACKEND_ERROR'
      );
    }

    const responseData = await response.json();
    console.log(`✅ [${debugContext}] Backend response received:`, JSON.stringify(responseData, null, 2));

    if (!responseData.success) {
      throw new BackendApiError(
        responseData.message || 'Social media analysis failed',
        responseData.status_code || 500,
        'ANALYSIS_FAILED'
      );
    }

    return responseData as BackendAnalysisResponse;

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error(`⏰ [${debugContext}] Request aborted due to timeout`);
      throw new BackendTimeoutError(`Social media analysis request timed out after ${BACKEND_CONFIG.timeout / 1000} seconds`);
    }
    
    if (error instanceof BackendApiError) {
      throw error;
    }
    
    console.error(`💥 [${debugContext}] Unexpected error:`, error);
    throw new BackendConnectionError(`Failed to connect to backend: ${error.message}`);
  }
}

// Website analysis with backend API
export async function analyzeWebsiteWithBackend(
  websiteRequest: WebsiteAnalysisRequest,
  debugContext: string = 'WEBSITE_ANALYSIS'
): Promise<BackendAnalysisResponse> {
  console.log(`🌐 [${debugContext}] Starting website analysis with backend API...`);
  console.log(`🌐 [${debugContext}] Website request:`, JSON.stringify(websiteRequest, null, 2));
  
  const apiKey = await getOrCreateApiKey();
  
  if (!apiKey) {
    throw new BackendApiError('Failed to obtain API key for website analysis', 401, 'AUTHENTICATION_ERROR');
  }

  const healthResult = await checkBackendHealth();
  if (!healthResult.isHealthy || !healthResult.workingUrl) {
    throw new BackendConnectionError(`Backend server is not responding. ${healthResult.error}`);
  }

  const requestUrl = `${healthResult.workingUrl}${BACKEND_CONFIG.endpoints.websiteAnalyze}`;
  console.log(`🌐 [${debugContext}] Making request to:`, requestUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`⏰ [${debugContext}] Request timeout after ${BACKEND_CONFIG.timeout}ms`);
    controller.abort();
  }, BACKEND_CONFIG.timeout);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(websiteRequest),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log(`🌐 [${debugContext}] Response status:`, response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${debugContext}] Backend error response:`, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      throw new BackendApiError(
        errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData.error_code || 'BACKEND_ERROR'
      );
    }

    const responseData = await response.json();
    console.log(`✅ [${debugContext}] Backend response received:`, JSON.stringify(responseData, null, 2));

    if (!responseData.success) {
      throw new BackendApiError(
        responseData.message || 'Website analysis failed',
        responseData.status_code || 500,
        'ANALYSIS_FAILED'
      );
    }

    return responseData as BackendAnalysisResponse;

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error(`⏰ [${debugContext}] Request aborted due to timeout`);
      throw new BackendTimeoutError(`Website analysis request timed out after ${BACKEND_CONFIG.timeout / 1000} seconds`);
    }
    
    if (error instanceof BackendApiError) {
      throw error;
    }
    
    console.error(`💥 [${debugContext}] Unexpected error:`, error);
    throw new BackendConnectionError(`Failed to connect to backend: ${error.message}`);
  }
}