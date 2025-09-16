import { useState, useEffect } from 'react';
import { analyzeEmailWithBackend, analyzeWebsiteWithBackend, analyzeSocialMediaWithBackend, submitScamReport, SocialMediaAnalysisRequest, ScamReportRequest, EmailScamReportData, WebsiteScamReportData, SocialMediaScamReportData } from '../../utils/backendApi';
import { detectSiteType, getSiteTypeDisplayName, type SiteDetectionResult } from '../../utils/urlDetection';

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

interface TwitterPostData {
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
    retweets?: number;
    replies?: number;
  };
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

type ScanMode = 'email' | 'website' | 'social' | 'search' | 'banking' | 'ecommerce';

// Multilingual text for report functionality
const getReportText = (language: string, key: string): string => {
  const reportTexts: { [lang: string]: { [key: string]: string } } = {
    en: {
      detected: 'Detected potential scam!',
      question: 'Report this to authorities?',
      button: 'Report to Authorities',
      reporting: 'Reporting...',
      success: 'Report Submitted Successfully!',
      successMessage: 'Thank you for reporting. Your report has been sent to authorities with ID:',
      failed: 'Report Failed',
      close: 'Close',
      tryAgain: 'Try Again',
      reported: 'Reported',
      reportedAt: 'Reported:'
    },
    zh: {
      detected: '检测到潜在诈骗！',
      question: '向当局举报？',
      button: '向当局举报',
      reporting: '正在举报...',
      success: '举报提交成功！',
      successMessage: '感谢您的举报。您的举报已发送给当局，ID：',
      failed: '举报失败',
      close: '关闭',
      tryAgain: '重试',
      reported: '已举报',
      reportedAt: '举报时间：'
    },
    ms: {
      detected: 'Penipuan berpotensi dikesan!',
      question: 'Laporkan kepada pihak berkuasa?',
      button: 'Laporkan kepada Pihak Berkuasa',
      reporting: 'Melaporkan...',
      success: 'Laporan Berjaya Dihantar!',
      successMessage: 'Terima kasih kerana melaporkan. Laporan anda telah dihantar kepada pihak berkuasa dengan ID:',
      failed: 'Laporan Gagal',
      close: 'Tutup',
      tryAgain: 'Cuba Lagi',
      reported: 'Telah Dilaporkan',
      reportedAt: 'Dilaporkan:'
    },
    vi: {
      detected: 'Đã phát hiện lừa đảo tiềm ẩn!',
      question: 'Báo cáo cho cơ quan chức năng?',
      button: 'Báo Cáo Cho Cơ Quan Chức Năng',
      reporting: 'Đang báo cáo...',
      success: 'Báo Cáo Đã Gửi Thành Công!',
      successMessage: 'Cảm ơn bạn đã báo cáo. Báo cáo của bạn đã được gửi cho cơ quan chức năng với ID:',
      failed: 'Báo Cáo Thất Bại',
      close: 'Đóng',
      tryAgain: 'Thử Lại',
      reported: 'Đã Báo Cáo',
      reportedAt: 'Báo cáo lúc:'
    },
    th: {
      detected: 'ตรวจพบการฉ้อโกงที่อาจเกิดขึ้น!',
      question: 'รายงานต่อเจ้าหน้าที่?',
      button: 'รายงานต่อเจ้าหน้าที่',
      reporting: 'กำลังรายงาน...',
      success: 'รายงานส่งสำเร็จ!',
      successMessage: 'ขอบคุณสำหรับการรายงาน รายงานของคุณได้ถูกส่งไปยังเจ้าหน้าที่แล้ว ID:',
      failed: 'รายงานล้มเหลว',
      close: 'ปิด',
      tryAgain: 'ลองใหม่',
      reported: 'รายงานแล้ว',
      reportedAt: 'รายงานเมื่อ:'
    },
    fil: {
      detected: 'Natuklasan ang posibleng scam!',
      question: 'Iulat ba ito sa mga awtoridad?',
      button: 'Iulat sa mga Awtoridad',
      reporting: 'Nag-uulat...',
      success: 'Matagumpay na Naipadala ang Ulat!',
      successMessage: 'Salamat sa pag-ulat. Ang inyong ulat ay naipadala na sa mga awtoridad na may ID:',
      failed: 'Nabigo ang Ulat',
      close: 'Isara',
      tryAgain: 'Subukan Muli',
      reported: 'Naiulat Na',
      reportedAt: 'Naiulat noong:'
    },
    id: {
      detected: 'Penipuan potensial terdeteksi!',
      question: 'Laporkan ke pihak berwenang?',
      button: 'Laporkan ke Pihak Berwenang',
      reporting: 'Melaporkan...',
      success: 'Laporan Berhasil Dikirim!',
      successMessage: 'Terima kasih telah melaporkan. Laporan Anda telah dikirim ke pihak berwenang dengan ID:',
      failed: 'Laporan Gagal',
      close: 'Tutup',
      tryAgain: 'Coba Lagi',
      reported: 'Sudah Dilaporkan',
      reportedAt: 'Dilaporkan pada:'
    },
    jv: {
      detected: 'Penipuan potensial katemokake!',
      question: 'Lapokno menyang panguwasa?',
      button: 'Lapokno menyang Panguwasa',
      reporting: 'Nglapokake...',
      success: 'Laporan Kasil Dikirim!',
      successMessage: 'Matur nuwun sampun nglapokake. Laporan sampeyan wis dikirim menyang panguwasa kanthi ID:',
      failed: 'Laporan Gagal',
      close: 'Tutup',
      tryAgain: 'Coba Maneh',
      reported: 'Wis Dilapokake',
      reportedAt: 'Dilapokake:'
    },
    su: {
      detected: 'Panipuan poténsial kadeteksi!',
      question: 'Laporkeun ka otoritas?',
      button: 'Laporkeun ka Otoritas',
      reporting: 'Ngalaporkeun...',
      success: 'Laporan Hasil Dikirim!',
      successMessage: 'Hatur nuhun parantos ngalaporkeun. Laporan anjeun parantos dikirim ka otoritas kalayan ID:',
      failed: 'Laporan Gagal',
      close: 'Tutup',
      tryAgain: 'Coba Deui',
      reported: 'Geus Dilaporkeun',
      reportedAt: 'Dilaporkeun:'
    },
    km: {
      detected: 'រកឃើញការបន្លំដែលអាចកើតឡើង!',
      question: 'រាយការណ៍ទៅអាជ្ញាធរ?',
      button: 'រាយការណ៍ទៅអាជ្ញាធរ',
      reporting: 'កំពុងរាយការណ៍...',
      success: 'រាយការណ៍បានផ្ញើដោយជោគជ័យ!',
      successMessage: 'សូមអរគុណសម្រាប់ការរាយការណ៍។ រាយការណ៍របស់អ្នកត្រូវបានផ្ញើទៅអាជ្ញាធរហើយជាមួយ ID:',
      failed: 'រាយការណ៍បរាជ័យ',
      close: 'បិទ',
      tryAgain: 'ព្យាយាមម្ដងទៀត',
      reported: 'បានរាយការណ៍ហើយ',
      reportedAt: 'រាយការណ៍នៅ:'
    },
    lo: {
      detected: 'ພົບເຫັນການຫລອກລວງທີ່ເປັນໄປໄດ້!',
      question: 'ລາຍງານໄປຫາເຈົ້າໜ້າທີ່?',
      button: 'ລາຍງານໄປຫາເຈົ້າໜ້າທີ່',
      reporting: 'ກຳລັງລາຍງານ...',
      success: 'ສົ່ງລາຍງານສຳເລັດແລ້ວ!',
      successMessage: 'ຂອບໃຈທີ່ລາຍງານ. ລາຍງານຂອງທ່ານໄດ້ຖືກສົ່ງໄປຫາເຈົ້າໜ້າທີ່ແລ້ວພ້ອມ ID:',
      failed: 'ລາຍງານລົ້ມເຫລວ',
      close: 'ປິດ',
      tryAgain: 'ລອງໃໝ່',
      reported: 'ລາຍງານແລ້ວ',
      reportedAt: 'ລາຍງານເວລາ:'
    },
    my: {
      detected: 'လိမ်လည်မှုဖြစ်နိုင်ချေကို တွေ့ရှိရပါသည်!',
      question: 'အာဏာပိုင်များထံ တိုင်ကြားမည်လား?',
      button: 'အာဏာပိုင်များထံ တိုင်ကြားရန်',
      reporting: 'တိုင်ကြားနေ...',
      success: 'တိုင်ကြားမှု အောင်မြင်စွာ ပေးပို့ပြီး!',
      successMessage: 'တိုင်ကြားမှုအတွက် ကျေးဇူးတင်ပါသည်။ သင်၏တိုင်ကြားမှုကို အာဏာပိုင်များထံ ID နှင့်အတူ ပေးပို့ပြီးပါသည်:',
      failed: 'တိုင်ကြားမှု မအောင်မြင်',
      close: 'ပိတ်',
      tryAgain: 'ထပ်စမ်း',
      reported: 'တိုင်ကြားပြီး',
      reportedAt: 'တိုင်ကြားသည့်အချိန်:'
    },
    ta: {
      detected: 'சாத்தியமான மோசடி கண்டறியப்பட்டது!',
      question: 'அதிகாரிகளிடம் புகார் செய்யலாமா?',
      button: 'அதிகாரிகளிடம் புகார் செய்',
      reporting: 'புகார் செய்து கொண்டிருக்கிறது...',
      success: 'புகார் வெற்றிகரமாக அனுப்பப்பட்டது!',
      successMessage: 'புகார் செய்ததற்கு நன்றி. உங்கள் புகார் அதிகாரிகளுக்கு ID உடன் அனுப்பப்பட்டுள்ளது:',
      failed: 'புகார் தோல்வியடைந்தது',
      close: 'மூடு',
      tryAgain: 'மீண்டும் முயற்சி',
      reported: 'புகார் செய்யப்பட்டது',
      reportedAt: 'புகார் செய்த நேரம்:'
    }
  };
  
  return reportTexts[language]?.[key] || reportTexts.en[key] || key;
};

// Helper function to check if analysis has been reported
const checkReportStatus = async (analysisData: any, scamType: 'email' | 'website' | 'socialmedia'): Promise<{ reported: boolean; reportId?: string; timestamp?: number }> => {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'GET_REPORT_STATUS',
      analysisData,
      scamType
    });
    
    if (response?.success) {
      return {
        reported: response.reported,
        reportId: response.reportId,
        timestamp: response.timestamp
      };
    }
  } catch (error) {
    console.error('Failed to check report status:', error);
  }
  
  return { reported: false };
};

// Helper function to check if risk level requires reporting (supports all languages)
const shouldShowReportFunction = (analysisResult: any): boolean => {
  if (!analysisResult) return false;
  
  const level = analysisResult.risk_level?.toLowerCase();
  if (!level) return false;
  
  // High risk patterns (English, Chinese, Malay, Indonesian, Vietnamese, Thai, Filipino, etc.)
  const highRiskPatterns = ['high', '高', '高风险', 'tinggi', 'risiko tinggi', 
                           'cao', 'rủi ro cao', 'สูง', 'ความเสี่ยงสูง', 
                           'mataas', 'dhuwur', 'luhur', 'ខ្ពស់', 'ສູງ', 'မြင့်', 'உயர்'];
  
  // Medium risk patterns (English, Chinese, Malay, Indonesian, Vietnamese, Thai, Filipino, etc.)
  const mediumRiskPatterns = ['medium', 'medium risk', '中', '中等', '中等风险', 
                             'sederhana', 'risiko sederhana', 'trung bình', 'rủi ro trung bình', 
                             'ปานกลาง', 'ความเสี่ยงปานกลาง', 'katamtaman', 
                             'madya', 'sedeng', 'មធ្យម', 'ປານກາງ', 'အလယ်', 'நடுத்தர'];
  
  return highRiskPatterns.some(pattern => level.includes(pattern)) ||
         mediumRiskPatterns.some(pattern => level.includes(pattern));
};

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<GmailData | null>(null);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  const [facebookData, setFacebookData] = useState<FacebookPostData | null>(null);
  const [twitterData, setTwitterData] = useState<TwitterPostData | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [scanMode, setScanMode] = useState<ScanMode>('email');
  const [facebookExtractionInProgress, setFacebookExtractionInProgress] = useState(false);
  const [twitterExtractionInProgress, setTwitterExtractionInProgress] = useState(false);
  
  // Auto-detection state
  const [autoDetectedSite, setAutoDetectedSite] = useState<SiteDetectionResult | null>(null);
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  
  // State to store the actual data being sent to backend for debugging
  const [backendRequestData, setBackendRequestData] = useState<any>(null);
  
  // Report functionality state
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [alreadyReported, setAlreadyReported] = useState<{ reportId?: string; timestamp?: number } | null>(null);

  // Initialize auto-detection and check for ongoing extractions when sidebar opens
  useEffect(() => {
    const initializeAutoDetection = async () => {
      try {
        
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id && tabs[0].url) {
          setCurrentTabId(tabs[0].id);
          
          // Get auto-detected site info from background script with error handling
          try {
            const siteInfo = await browser.runtime.sendMessage({
              type: 'GET_SITE_DETECTION',
              tabId: tabs[0].id
            });
            
            if (siteInfo?.detection) {
              console.log('🔍 [SIDEBAR] Auto-detected site:', siteInfo.detection);
              setAutoDetectedSite(siteInfo.detection);
              setScanMode(siteInfo.detection.type);
            } else {
              // Fallback: detect site type manually if background hasn't detected it yet
              const detection = detectSiteType(tabs[0].url);
              console.log('🔍 [SIDEBAR] Manual detection fallback:', detection);
              setAutoDetectedSite(detection);
              setScanMode(detection.type);
            }
          } catch (backgroundError) {
            console.error('Failed to get site detection from background:', backgroundError);
            // Still try manual detection as fallback
            try {
              const detection = detectSiteType(tabs[0].url);
              console.log('🔍 [SIDEBAR] Emergency fallback detection:', detection);
              setAutoDetectedSite(detection);
              setScanMode(detection.type);
            } catch (fallbackError) {
              console.error('Manual detection also failed:', fallbackError);
              setError('Failed to detect website type. Please try refreshing the page.');
            }
          }
          
          // Check for ongoing Facebook extraction specifically with error handling
          if (tabs[0].url.includes('facebook.com')) {
            try {
              const response = await browser.tabs.sendMessage(tabs[0].id, { type: 'CHECK_FACEBOOK_EXTRACTION_STATUS' });
              if (response?.inProgress) {
                setFacebookExtractionInProgress(true);
                setLoading(true);
                setScanMode('social');
                pollForFacebookData(tabs[0].id);
              } else if (response?.data) {
                setFacebookData(response.data);
                setScanMode('social');
              }
            } catch (facebookError) {
              console.error('Failed to check Facebook extraction status:', facebookError);
              // Don't set error for this as it's not critical
            }
          }

          // Check for ongoing Twitter extraction specifically with error handling
          if (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com')) {
            try {
              const response = await browser.tabs.sendMessage(tabs[0].id, { type: 'CHECK_TWITTER_EXTRACTION_STATUS' });
              if (response?.inProgress) {
                setTwitterExtractionInProgress(true);
                setLoading(true);
                setScanMode('social');
                pollForTwitterData(tabs[0].id);
              } else if (response?.data) {
                setTwitterData(response.data);
                setScanMode('social');
              }
            } catch (twitterError) {
              console.error('Failed to check Twitter extraction status:', twitterError);
              // Don't set error for this as it's not critical
            }
          }
          
          // Try to restore any existing analysis state for this tab
          try {
            const storedState = await browser.runtime.sendMessage({ type: 'GET_ANALYSIS_STATE' });
            if (storedState?.success && storedState.analysisResult) {
              console.log(`🔄 [SIDEBAR INIT] Restoring analysis state for current tab:`, storedState.scamType);
              
              // Restore analysis result and data
              setAnalysisResult(storedState.analysisResult);
              if (storedState.extractedData) {
                setExtractedData(storedState.extractedData);
              }
              if (storedState.websiteData) {
                setWebsiteData(storedState.websiteData);
              }
              if (storedState.facebookData) {
                setFacebookData(storedState.facebookData);
              }
              if (storedState.twitterData) {
                setTwitterData(storedState.twitterData);
              }

              // Restore report status if available
              if (storedState.reportStatus) {
                setAlreadyReported(storedState.reportStatus);
                console.log(`🔄 [SIDEBAR INIT] Restored report status:`, storedState.reportStatus);
              }
            }
          } catch (error) {
            console.error('Failed to restore analysis state on init:', error);
          }
        }
      } catch (error) {
        console.error('Critical error initializing auto-detection:', error);
        setError('Failed to initialize extension. Please try refreshing the page.');
      }
    };

    initializeAutoDetection();
    
    // Listen for tab switches and URL changes from background script
    const handleBackgroundMessages = (message: any) => {
      if (message.type === 'TAB_SWITCHED') {
        console.log('🔄 [SIDEBAR] Received tab switch notification:', message);
        handleTabSwitch(message.tabId, message.tabInfo);
      } else if (message.type === 'TAB_URL_CHANGED') {
        console.log('🔄 [SIDEBAR] Received URL change notification:', message);
        // Handle URL change in current tab
        if (message.tabId === currentTabId) {
          handleUrlChange(message.tabId, message.tabInfo);
        }
      } else if (message.type === 'MANUAL_DETECTION_COMPLETE') {
        console.log('🔄 [SIDEBAR] Received manual detection complete notification:', message);
        // Handle manual detection completion
        if (message.tabId === currentTabId && message.tabInfo?.detection) {
          setAutoDetectedSite(message.tabInfo.detection);
          setScanMode(message.tabInfo.detection.type);
          console.log('🔄 [SIDEBAR] Updated UI after manual detection:', message.tabInfo.detection);
        }
      } else if (message.type === 'INITIAL_DETECTION_COMPLETE') {
        console.log('🚀 [SIDEBAR] Received initial detection complete notification:', message);
        // Handle initial detection completion (for manual URL changes)
        if (message.tabId === currentTabId && message.tabInfo?.detection) {
          setAutoDetectedSite(message.tabInfo.detection);
          setScanMode(message.tabInfo.detection.type);
          console.log('🚀 [SIDEBAR] Updated UI after initial detection:', message.tabInfo.detection);
        }
      }
    };
    
    browser.runtime.onMessage.addListener(handleBackgroundMessages);
    
    return () => {
      browser.runtime.onMessage.removeListener(handleBackgroundMessages);
    };
  }, [currentTabId]);

  // Function to handle tab switch notifications from background script
  const handleTabSwitch = async (tabId: number, tabInfo: any) => {
    try {
      console.log(`🔄 [SIDEBAR] Handling tab switch to ${tabId}:`, tabInfo);
      
      // Update current tab ID
      setCurrentTabId(tabId);
      
      // Clear previous data first
      setExtractedData(null);
      setWebsiteData(null);
      setFacebookData(null);
      setTwitterData(null);
      setAnalysisResult(null);
      setError(null);
      setLoading(false);
      setFacebookExtractionInProgress(false);
      setTwitterExtractionInProgress(false);
      
      // Clear report status when switching tabs
      setReportSuccess(null);
      setReportError(null);
      setReportLoading(false);
      setAlreadyReported(null);
      
      // Try to restore analysis state for this tab
      try {
        const storedState = await browser.runtime.sendMessage({ type: 'GET_ANALYSIS_STATE' });
        if (storedState?.success && storedState.analysisResult) {
          console.log(`🔄 [SIDEBAR] Restoring analysis state for tab ${tabId}:`, storedState.scamType);
          
          // Restore analysis result and data
          setAnalysisResult(storedState.analysisResult);
          if (storedState.extractedData) {
            setExtractedData(storedState.extractedData);
          }
          if (storedState.websiteData) {
            setWebsiteData(storedState.websiteData);
          }
          if (storedState.facebookData) {
            setFacebookData(storedState.facebookData);
          }
          if (storedState.twitterData) {
            setTwitterData(storedState.twitterData);
          }

          // Restore report status if available
          if (storedState.reportStatus) {
            setAlreadyReported(storedState.reportStatus);
            console.log(`🔄 [SIDEBAR] Restored report status for tab ${tabId}:`, storedState.reportStatus);
          }
        }
      } catch (error) {
        console.error('Failed to restore analysis state:', error);
      }
      
      if (tabInfo?.detection) {
        // Update auto-detected site info
        setAutoDetectedSite(tabInfo.detection);
        setScanMode(tabInfo.detection.type);
        
        console.log(`🔄 [SIDEBAR] Updated detection for tab ${tabId}:`, tabInfo.detection);
        
        // If this is Facebook and we're switching to it, check for existing data
        if (tabInfo.detection.type === 'social' && tabInfo.detection.platform === 'facebook') {
          try {
            const response = await browser.tabs.sendMessage(tabId, { type: 'CHECK_FACEBOOK_EXTRACTION_STATUS' });
            if (response?.inProgress) {
              setFacebookExtractionInProgress(true);
              setLoading(true);
              pollForFacebookData(tabId);
            } else if (response?.data) {
              setFacebookData(response.data);
            }
          } catch (error) {
            console.error('Failed to check Facebook status on tab switch:', error);
          }
        }

        // If this is Twitter and we're switching to it, check for existing data
        if (tabInfo.detection.type === 'social' && tabInfo.detection.platform === 'twitter') {
          try {
            const response = await browser.tabs.sendMessage(tabId, { type: 'CHECK_TWITTER_EXTRACTION_STATUS' });
            if (response?.inProgress) {
              setTwitterExtractionInProgress(true);
              setLoading(true);
              pollForTwitterData(tabId);
            } else if (response?.data) {
              setTwitterData(response.data);
            }
          } catch (error) {
            console.error('Failed to check Twitter status on tab switch:', error);
          }
        }
      } else {
        // No detection info available, try to detect manually
        try {
          const tabs = await browser.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.url) {
            const detection = detectSiteType(tabs[0].url);
            setAutoDetectedSite(detection);
            setScanMode(detection.type);
            console.log(`🔄 [SIDEBAR] Manual detection on tab switch:`, detection);
          }
        } catch (error) {
          console.error('Failed to detect site type on tab switch:', error);
        }
      }
      
    } catch (error) {
      console.error('Error handling tab switch:', error);
      setError('Failed to update after tab switch. Please try refreshing.');
    }
  };

  // Function to handle URL change notifications from background script
  const handleUrlChange = async (tabId: number, tabInfo: any) => {
    try {
      console.log(`🔄 [SIDEBAR] Handling URL change in tab ${tabId}:`, tabInfo);
      
      if (tabInfo?.detection) {
        // Update auto-detected site info
        setAutoDetectedSite(tabInfo.detection);
        setScanMode(tabInfo.detection.type);
        
        console.log(`🔄 [SIDEBAR] Updated detection after URL change:`, tabInfo.detection);
        
        // Clear previous analysis data when URL changes significantly
        setAnalysisResult(null);
        setBackendRequestData(null);
        setError(null);
        
        // Reset extraction states
        setFacebookExtractionInProgress(false);
        setLoading(false);
        
        // Clear extracted data to force fresh extraction
        setExtractedData(null);
        setWebsiteData(null);
        setFacebookData(null);
        setTwitterData(null);
        
        // Clear report status when URL changes
        setReportSuccess(null);
        setReportError(null);
        setReportLoading(false);
        setAlreadyReported(null);
        
        // Clear report status in background
        browser.runtime.sendMessage({ type: 'CLEAR_REPORT_STATUS' }).catch(() => {});
        
        // If this is Facebook and we're switching to it, check for existing data
        if (tabInfo.detection.type === 'social' && tabInfo.detection.platform === 'facebook') {
          try {
            const response = await browser.tabs.sendMessage(tabId, { type: 'CHECK_FACEBOOK_EXTRACTION_STATUS' });
            if (response?.inProgress) {
              setFacebookExtractionInProgress(true);
              setLoading(true);
              pollForFacebookData(tabId);
            } else if (response?.data) {
              setFacebookData(response.data);
            }
          } catch (error) {
            console.error('Failed to check Facebook status on URL change:', error);
          }
        }

        // If this is Twitter and we're switching to it, check for existing data
        if (tabInfo.detection.type === 'social' && tabInfo.detection.platform === 'twitter') {
          try {
            const response = await browser.tabs.sendMessage(tabId, { type: 'CHECK_TWITTER_EXTRACTION_STATUS' });
            if (response?.inProgress) {
              setTwitterExtractionInProgress(true);
              setLoading(true);
              pollForTwitterData(tabId);
            } else if (response?.data) {
              setTwitterData(response.data);
            }
          } catch (error) {
            console.error('Failed to check Twitter status on URL change:', error);
          }
        }
      }
      
    } catch (error) {
      console.error('Error handling URL change:', error);
      setError('Failed to update after URL change. Please try refreshing.');
    }
  };

  // Function to handle manual redetection
  const handleManualRedetect = async () => {
    try {
      console.log('🔄 [SIDEBAR] Manual redetect button clicked');
      setError(null);
      
      // Get current tab
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        setError('No active tab found');
        return;
      }
      
      const tabId = tabs[0].id;
      console.log('🔄 [SIDEBAR] Requesting manual redetection for tab', tabId);
      
      // Request manual redetection from content script
      try {
        const response = await browser.tabs.sendMessage(tabId, { type: 'MANUAL_REDETECT' });
        console.log('🔄 [SIDEBAR] Manual redetect response:', response);
        
        if (response?.success) {
          // Also get current URL info for immediate update
          try {
            const urlInfoResponse = await browser.tabs.sendMessage(tabId, { type: 'GET_CURRENT_URL_INFO' });
            if (urlInfoResponse?.success && urlInfoResponse.detection) {
              console.log('🔄 [SIDEBAR] Got current URL info:', urlInfoResponse);
              setAutoDetectedSite(urlInfoResponse.detection);
              setScanMode(urlInfoResponse.detection.type);
              
              // Show success message temporarily
              const originalError = error;
              setError('✅ Site redetected successfully!');
              setTimeout(() => {
                setError(originalError);
              }, 2000);
            }
          } catch (urlInfoError) {
            console.log('Could not get immediate URL info:', urlInfoError);
          }
        } else {
          setError('Failed to trigger redetection');
        }
      } catch (messageError) {
        console.error('Failed to send redetect message:', messageError);
        setError('Could not communicate with page. Try refreshing the page.');
      }
      
    } catch (error) {
      console.error('Error in manual redetect:', error);
      setError('Manual redetection failed. Please try refreshing the page.');
    }
  };

  // Function to poll for Facebook extraction completion
  const pollForFacebookData = async (tabId: number) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await browser.tabs.sendMessage(tabId, { type: 'CHECK_FACEBOOK_EXTRACTION_STATUS' });
        if (!response?.inProgress) {
          clearInterval(pollInterval);
          setFacebookExtractionInProgress(false);
          
          if (response?.data) {
            setFacebookData(response.data);
            // Automatically analyze the extracted Facebook post with backend
            await analyzeFacebookPost(response.data, tabId);
          } else {
            setLoading(false);
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

  // Function to poll for Twitter extraction completion
  const pollForTwitterData = async (tabId: number) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await browser.tabs.sendMessage(tabId, { type: 'CHECK_TWITTER_EXTRACTION_STATUS' });
        if (!response?.inProgress) {
          clearInterval(pollInterval);
          setTwitterExtractionInProgress(false);

          if (response?.data) {
            setTwitterData(response.data);
            // Automatically analyze the extracted Twitter post with backend
            await analyzeTwitterPost(response.data, tabId);
          } else {
            setLoading(false);
            setError('Twitter extraction was cancelled or failed.');
          }
        }
      } catch (error) {
        console.error('Error polling for Twitter data:', error);
        clearInterval(pollInterval);
        setLoading(false);
        setTwitterExtractionInProgress(false);
        setError('Lost connection to Twitter extraction.');
      }
    }, 1000); // Poll every second

    // Stop polling after 60 seconds to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
      if (twitterExtractionInProgress) {
        setLoading(false);
        setTwitterExtractionInProgress(false);
        setError('Twitter extraction timed out.');
      }
    }, 60000);
  };

  // Function to analyze Twitter post with backend API
  const analyzeTwitterPost = async (twitterPostData: TwitterPostData, tabId?: number) => {
    try {
      console.log('🐦 [SIDEBAR - ANALYZE TWITTER] Starting Twitter post analysis...');

      // Show loading modal on website if tabId is provided
      if (tabId) {
        console.log('🐦 [SIDEBAR - ANALYZE TWITTER] Showing loading modal on website...');
        await browser.tabs.sendMessage(tabId, {
          type: 'SHOW_ANALYSIS_MODAL',
          result: null,
          loading: true,
          analysisType: 'social_media'
        });
      }

      // Convert image to base64 if present
      let base64Image: string | undefined = undefined;
      if (twitterPostData.image && tabId) {
        try {
          console.log('📷 [SIDEBAR - ANALYZE TWITTER] Converting image to base64...');
          // Use content script to convert image since it has access to the page context
          const base64Response = await browser.tabs.sendMessage(tabId, {
            type: 'CONVERT_IMAGE_TO_BASE64',
            imageUrl: twitterPostData.image
          });

          if (base64Response && base64Response.success && base64Response.base64) {
            base64Image = base64Response.base64;
            console.log('✅ [SIDEBAR - ANALYZE TWITTER] Image converted to base64 successfully');
          } else {
            console.error('❌ [SIDEBAR - ANALYZE TWITTER] Content script failed to convert image:', base64Response?.error);
          }
        } catch (error) {
          console.error('❌ [SIDEBAR - ANALYZE TWITTER] Failed to convert image to base64:', error);
          // Continue without image if conversion fails
        }
      }

      // Prepare social media request for backend
      const socialMediaRequest: SocialMediaAnalysisRequest = {
        platform: 'twitter',
        content: twitterPostData.caption || '',
        author_username: twitterPostData.username || '',
        target_language: selectedLanguage,
        image: base64Image,
        post_url: twitterPostData.postUrl || '',
        author_followers_count: twitterPostData.author_followers_count,
        engagement_metrics: twitterPostData.engagement_metrics
      };

      // Store the backend request data for debugging display
      setBackendRequestData({
        type: 'social_media',
        data: socialMediaRequest,
        timestamp: new Date().toISOString()
      });

      console.log('📤 [SIDEBAR - ANALYZE TWITTER] Sending to backend:', JSON.stringify(socialMediaRequest, null, 2));

      // Call backend API v2 for social media analysis
      const backendResponse = await analyzeSocialMediaWithBackend(socialMediaRequest, 'ANALYZE TWITTER POST - SIDEBAR V2 CONTEXT');

      console.log('📥 [SIDEBAR - ANALYZE TWITTER] Backend response:', JSON.stringify(backendResponse, null, 2));

      if (!backendResponse.success || !backendResponse.data) {
        throw new Error('Invalid response from backend');
      }

      console.log('🔍 [SIDEBAR - ANALYZE TWITTER] Parsing backend response structure...');
      console.log('📋 [SIDEBAR - ANALYZE TWITTER] Data keys:', Object.keys(backendResponse.data));

      // Extract analysis data - social media API returns nested under language code
      let analysisData;
      const responseData = backendResponse.data as any; // Type assertion for social media response
      if (responseData[selectedLanguage]) {
        // Social media API format: data.{language_code}.{analysis_fields}
        analysisData = responseData[selectedLanguage];
        console.log('✅ [SIDEBAR - ANALYZE TWITTER] Found analysis data under language code:', selectedLanguage);
      } else if (backendResponse.data.risk_level) {
        // Direct format (fallback): data.{analysis_fields}
        analysisData = backendResponse.data;
        console.log('✅ [SIDEBAR - ANALYZE TWITTER] Found analysis data in direct format');
      } else {
        console.error('❌ [SIDEBAR - ANALYZE TWITTER] Could not find analysis data in response');
        throw new Error('Analysis data not found in response');
      }

      console.log('📊 [SIDEBAR - ANALYZE TWITTER] Extracted analysis data:', analysisData);

      // Format the analysis result
      const analysisResult = {
        risk_level: analysisData.risk_level,
        analysis: analysisData.analysis || analysisData.reasons, // Handle both field names
        recommended_action: analysisData.recommended_action,
        detected_language: backendResponse.data.detected_language || 'auto-detected',
        target_language: selectedLanguage,
        target_language_name: LANGUAGE_OPTIONS.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage,
        legitimate_url: analysisData.legitimate_url || backendResponse.data.legitimate_url
      };

      console.log('📋 [SIDEBAR - ANALYZE TWITTER] Formatted analysis result:', analysisResult);

      // Store analysis result in state for reporting functionality
      setAnalysisResult(analysisResult);

      // Check if this analysis has already been reported
      const reportStatus = await checkReportStatus(twitterPostData, 'socialmedia');
      if (reportStatus.reported) {
        setAlreadyReported({ reportId: reportStatus.reportId, timestamp: reportStatus.timestamp });
        console.log('📢 [SIDEBAR - ANALYZE TWITTER] Analysis already reported:', reportStatus);
      } else {
        setAlreadyReported(null);
      }

      // Store analysis state in background for tab persistence
      browser.runtime.sendMessage({
        type: 'STORE_ANALYSIS_STATE',
        analysisResult: analysisResult,
        twitterData: twitterPostData,
        scamType: 'socialmedia'
      }).catch((error) => {
        console.error('Failed to store analysis state:', error);
      });

      // Show analysis result on website if tabId is provided
      if (tabId) {
        console.log('🐦 [SIDEBAR - ANALYZE TWITTER] Showing analysis result on website...');
        await browser.tabs.sendMessage(tabId, {
          type: 'SHOW_ANALYSIS_MODAL',
          result: analysisResult,
          loading: false,
          analysisType: 'social_media'
        });
      }

      console.log('✅ [SIDEBAR - ANALYZE TWITTER] Twitter post analysis completed successfully');

    } catch (error: any) {
      console.error('❌ [SIDEBAR - ANALYZE TWITTER] Twitter analysis error:', error);

      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during analysis';
      setError(`Twitter analysis failed: ${errorMessage}`);

      // Show error on website if tabId is provided
      if (tabId) {
        await browser.tabs.sendMessage(tabId, {
          type: 'SHOW_ANALYSIS_ERROR',
          error: errorMessage,
          language: selectedLanguage
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to analyze Facebook post with backend API
  const analyzeFacebookPost = async (facebookPostData: FacebookPostData, tabId?: number) => {
    try {
      console.log('📱 [SIDEBAR - ANALYZE FACEBOOK] Starting Facebook post analysis...');
      
      // Show loading modal on website if tabId is provided
      if (tabId) {
        console.log('📱 [SIDEBAR - ANALYZE FACEBOOK] Showing loading modal on website...');
        await browser.tabs.sendMessage(tabId, { 
          type: 'SHOW_ANALYSIS_MODAL', 
          result: null, 
          loading: true,
          analysisType: 'social_media'
        });
      }

      // Convert image to base64 if present
      let base64Image: string | undefined = undefined;
      if (facebookPostData.image && tabId) {
        try {
          console.log('📷 [SIDEBAR - ANALYZE FACEBOOK] Converting image to base64...');
          // Use content script to convert image since it has access to the page context
          const base64Response = await browser.tabs.sendMessage(tabId, { 
            type: 'CONVERT_IMAGE_TO_BASE64', 
            imageUrl: facebookPostData.image 
          });
          
          if (base64Response && base64Response.success && base64Response.base64) {
            base64Image = base64Response.base64;
            console.log('✅ [SIDEBAR - ANALYZE FACEBOOK] Image converted to base64 successfully');
          } else {
            console.error('❌ [SIDEBAR - ANALYZE FACEBOOK] Content script failed to convert image:', base64Response?.error);
          }
        } catch (error) {
          console.error('❌ [SIDEBAR - ANALYZE FACEBOOK] Failed to convert image to base64:', error);
          // Continue without image if conversion fails
        }
      }

      // Prepare social media request for backend
      const socialMediaRequest: SocialMediaAnalysisRequest = {
        platform: 'facebook',
        content: facebookPostData.caption || '',
        author_username: facebookPostData.username || '',
        target_language: selectedLanguage,
        image: base64Image,
        post_url: facebookPostData.postUrl || '',
        author_followers_count: facebookPostData.author_followers_count,
        engagement_metrics: facebookPostData.engagement_metrics
      };

      // Store the backend request data for debugging display
      setBackendRequestData({
        type: 'social_media',
        data: socialMediaRequest,
        timestamp: new Date().toISOString()
      });

      console.log('📤 [SIDEBAR - ANALYZE FACEBOOK] Sending to backend:', JSON.stringify(socialMediaRequest, null, 2));

      // Call backend API v2 for social media analysis
      const backendResponse = await analyzeSocialMediaWithBackend(socialMediaRequest, 'ANALYZE FACEBOOK POST - SIDEBAR V2 CONTEXT');
      
      console.log('📥 [SIDEBAR - ANALYZE FACEBOOK] Backend response:', JSON.stringify(backendResponse, null, 2));

      if (!backendResponse.success || !backendResponse.data) {
        throw new Error('Invalid response from backend');
      }

      console.log('🔍 [SIDEBAR - ANALYZE FACEBOOK] Parsing backend response structure...');
      console.log('📋 [SIDEBAR - ANALYZE FACEBOOK] Data keys:', Object.keys(backendResponse.data));

      // Extract analysis data - social media API returns nested under language code
      let analysisData;
      const responseData = backendResponse.data as any; // Type assertion for social media response
      if (responseData[selectedLanguage]) {
        // Social media API format: data.{language_code}.{analysis_fields}
        analysisData = responseData[selectedLanguage];
        console.log('✅ [SIDEBAR - ANALYZE FACEBOOK] Found analysis data under language code:', selectedLanguage);
      } else if (backendResponse.data.risk_level) {
        // Direct format (fallback): data.{analysis_fields}
        analysisData = backendResponse.data;
        console.log('✅ [SIDEBAR - ANALYZE FACEBOOK] Found analysis data in direct format');
      } else {
        console.error('❌ [SIDEBAR - ANALYZE FACEBOOK] Could not find analysis data in response');
        throw new Error('Analysis data not found in response');
      }

      console.log('📊 [SIDEBAR - ANALYZE FACEBOOK] Extracted analysis data:', analysisData);

      // Format the analysis result
      const analysisResult = {
        risk_level: analysisData.risk_level,
        analysis: analysisData.analysis || analysisData.reasons, // Handle both field names
        recommended_action: analysisData.recommended_action,
        detected_language: backendResponse.data.detected_language || 'auto-detected',
        target_language: selectedLanguage,
        target_language_name: LANGUAGE_OPTIONS.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage,
        legitimate_url: analysisData.legitimate_url || backendResponse.data.legitimate_url
      };

      console.log('📋 [SIDEBAR - ANALYZE FACEBOOK] Formatted analysis result:', analysisResult);
      
      // Store analysis result in state for reporting functionality
      setAnalysisResult(analysisResult);
      
      // Check if this analysis has already been reported
      const reportStatus = await checkReportStatus(facebookPostData, 'socialmedia');
      if (reportStatus.reported) {
        setAlreadyReported({ reportId: reportStatus.reportId, timestamp: reportStatus.timestamp });
        console.log('📢 [SIDEBAR - ANALYZE FACEBOOK] Analysis already reported:', reportStatus);
      } else {
        setAlreadyReported(null);
      }
      
      // Store analysis state in background for tab persistence
      browser.runtime.sendMessage({
        type: 'STORE_ANALYSIS_STATE',
        analysisResult: analysisResult,
        facebookData: facebookPostData,
        scamType: 'socialmedia'
      }).catch((error) => {
        console.error('Failed to store analysis state:', error);
      });
      
      // Show analysis result on website if tabId is provided
      if (tabId) {
        console.log('📱 [SIDEBAR - ANALYZE FACEBOOK] Showing analysis result on website...');
        await browser.tabs.sendMessage(tabId, { 
          type: 'SHOW_ANALYSIS_MODAL', 
          result: analysisResult, 
          loading: false,
          analysisType: 'social_media'
        });
      }

      console.log('✅ [SIDEBAR - ANALYZE FACEBOOK] Facebook post analysis completed successfully');
      
    } catch (error: any) {
      console.error('❌ [SIDEBAR - ANALYZE FACEBOOK] Facebook analysis error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during analysis';
      setError(`Facebook analysis failed: ${errorMessage}`);
      
      // Show error on website if tabId is provided
      if (tabId) {
        await browser.tabs.sendMessage(tabId, { 
          type: 'SHOW_ANALYSIS_ERROR', 
          error: errorMessage,
          language: selectedLanguage
        });
      }
    } finally {
      setLoading(false);
    }
  };

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
          loading: true,
          analysisType: 'email'
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
          
          // Store the backend request data for debugging display
          setBackendRequestData({
            type: 'email',
            data: backendRequest,
            timestamp: new Date().toISOString()
          });
          
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
              target_language_name: LANGUAGE_OPTIONS.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage,
              legitimate_url: backendResponse.data.legitimate_url
            };
            
            // Store analysis result in state for reporting functionality
            setAnalysisResult(analysisData);
            
            // Check if this analysis has already been reported
            const reportStatus = await checkReportStatus(gmailData, 'email');
            if (reportStatus.reported) {
              setAlreadyReported({ reportId: reportStatus.reportId, timestamp: reportStatus.timestamp });
              console.log('📢 [SIDEBAR - ANALYZE EMAIL] Analysis already reported:', reportStatus);
            } else {
              setAlreadyReported(null);
            }
            
            // Store analysis state in background for tab persistence
            browser.runtime.sendMessage({
              type: 'STORE_ANALYSIS_STATE',
              analysisResult: analysisData,
              extractedData: gmailData,
              scamType: 'email'
            }).catch((error) => {
              console.error('Failed to store analysis state:', error);
            });
            
            // Show analysis result modal on website
            await browser.tabs.sendMessage(tabs[0].id, { 
              type: 'SHOW_ANALYSIS_MODAL', 
              result: analysisData, 
              loading: false,
              analysisType: 'email'
            });
            
            console.log('✅ [SIDEBAR - ANALYZE EMAIL] Analysis completed and modal displayed on website');
          } else {
            throw new Error(backendResponse.message || 'Analysis failed - no data received');
          }
          
        } else {
          // Show error modal on website
          await browser.tabs.sendMessage(tabs[0].id, { 
            type: 'SHOW_ANALYSIS_ERROR', 
            error: 'No email data found. Make sure you have an email open in Gmail.',
            language: selectedLanguage
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
          error: errorMessage,
          language: selectedLanguage
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

  // Function to analyze website for scam - identical to popup functionality
  const analyzeWebsiteForScam = async () => {
    setLoading(true);
    setError(null);
    // Don't clear websiteData - we want to show what we're analyzing
    
    try {
      console.log('🌐 [SIDEBAR - ANALYZE WEBSITE] Starting website analysis...');
      
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found.');
      }

      // Show loading modal on website immediately 
      console.log('🌐 [SIDEBAR - ANALYZE WEBSITE] Showing loading modal on website...');
      await browser.tabs.sendMessage(tabs[0].id, { 
        type: 'SHOW_ANALYSIS_MODAL', 
        result: null, 
        loading: true,
        analysisType: 'website'
      });

      // Get website data using DOM parsing
      console.log('🌐 [SIDEBAR - ANALYZE WEBSITE] Extracting website data...');
      const websiteData = await browser.tabs.sendMessage(tabs[0].id, { type: 'GET_WEBSITE_DATA' });
      
      if (!websiteData) {
        throw new Error('Failed to extract website content. Please try again.');
      }

      console.log('🌐 [SIDEBAR - ANALYZE WEBSITE] Extracted website data:', websiteData);

      // Set website data for sidebar display
      setWebsiteData(websiteData);

      // Prepare backend request
      const backendRequest = {
        url: websiteData.url || tabs[0].url || 'unknown',
        title: websiteData.title || '',
        content: websiteData.content || '',
        target_language: selectedLanguage,
        metadata: websiteData.metadata || {}
      };

      // Store the backend request data for debugging display
      setBackendRequestData({
        type: 'website',
        data: backendRequest,
        timestamp: new Date().toISOString()
      });

      console.log('📤 [SIDEBAR - ANALYZE WEBSITE] Sending to backend:', JSON.stringify(backendRequest, null, 2));

      // Call backend API v2
      const backendResponse = await analyzeWebsiteWithBackend(backendRequest, 'ANALYZE WEBSITE BUTTON - SIDEBAR V2 CONTEXT');
      
      console.log('📥 [SIDEBAR - ANALYZE WEBSITE] Backend response:', JSON.stringify(backendResponse, null, 2));
      
      // Check if response is successful and has data
      if (backendResponse.success && backendResponse.data) {
        const analysisData = {
          risk_level: backendResponse.data.risk_level,
          analysis: backendResponse.data.reasons,
          recommended_action: backendResponse.data.recommended_action,
          detected_language: backendResponse.data.detected_language || 'unknown',
          target_language: selectedLanguage,
          target_language_name: LANGUAGE_OPTIONS.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage,
          legitimate_url: backendResponse.data.legitimate_url
        };
        
        // Store analysis result in state for reporting functionality
        setAnalysisResult(analysisData);
        
        // Check if this analysis has already been reported
        const reportStatus = await checkReportStatus(websiteData, 'website');
        if (reportStatus.reported) {
          setAlreadyReported({ reportId: reportStatus.reportId, timestamp: reportStatus.timestamp });
          console.log('📢 [SIDEBAR - ANALYZE WEBSITE] Analysis already reported:', reportStatus);
        } else {
          setAlreadyReported(null);
        }
        
        // Store analysis state in background for tab persistence
        browser.runtime.sendMessage({
          type: 'STORE_ANALYSIS_STATE',
          analysisResult: analysisData,
          websiteData: websiteData,
          scamType: 'website'
        }).catch((error) => {
          console.error('Failed to store analysis state:', error);
        });
        
        // Show analysis result modal on website
        await browser.tabs.sendMessage(tabs[0].id, { 
          type: 'SHOW_ANALYSIS_MODAL', 
          result: analysisData, 
          loading: false,
          analysisType: 'website'
        });
        
        console.log('✅ [SIDEBAR - ANALYZE WEBSITE] Analysis completed and modal displayed on website');
      } else {
        throw new Error(backendResponse.message || 'Analysis failed - no data received');
      }
      
    } catch (err: any) {
      console.error('❌ [SIDEBAR - ANALYZE WEBSITE] Error:', err);
      
      try {
        // Show error modal on website
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          await browser.tabs.sendMessage(tabs[0].id, { 
            type: 'SHOW_ANALYSIS_ERROR', 
            error: err.message || 'Analysis failed',
            language: selectedLanguage
          });
        }
      } catch (modalError) {
        console.error('Failed to show error modal:', modalError);
        // Fallback to sidebar error display
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

  // Function to submit scam report to authorities
  const handleSubmitReport = async (scamType: 'email' | 'website' | 'socialmedia') => {
    if (!analysisResult) {
      setReportError('No analysis result available to report');
      return;
    }

    setReportLoading(true);
    setReportError(null);
    setReportSuccess(null);

    try {
      console.log('📢 [SIDEBAR] Starting scam report submission...', scamType);

      let reportRequest: ScamReportRequest;

      if (scamType === 'email' && extractedData) {
        const emailData: EmailScamReportData = {
          subject: extractedData.subject,
          content: extractedData.content,
          from_email: extractedData.from,
          reply_to_email: extractedData.replyTo !== 'None' ? extractedData.replyTo : undefined,
          risk_level: analysisResult.risk_level,
          analysis: analysisResult.analysis,
          recommended_action: analysisResult.recommended_action,
          detected_language: analysisResult.detected_language,
          content_hash: undefined // Could add hash generation if needed
        };

        reportRequest = {
          scam_type: 'email',
          email_data: emailData,
          user_comment: `Report submitted from mAIscam extension at ${new Date().toISOString()}`
        };
      } else if (scamType === 'website' && websiteData) {
        const websiteReportData: WebsiteScamReportData = {
          url: websiteData.url,
          title: websiteData.title,
          content: websiteData.content,
          risk_level: analysisResult.risk_level,
          analysis: analysisResult.analysis,
          recommended_action: analysisResult.recommended_action,
          detected_language: analysisResult.detected_language,
          content_hash: undefined, // Could add hash generation if needed
          metadata: websiteData.metadata
        };

        reportRequest = {
          scam_type: 'website',
          website_data: websiteReportData,
          user_comment: `Report submitted from mAIscam extension at ${new Date().toISOString()}`
        };
      } else if (scamType === 'socialmedia' && (facebookData || twitterData)) {
        const socialData = facebookData || twitterData;
        const platform = facebookData ? 'facebook' : 'twitter';

        if (!socialData) {
          throw new Error('No social media data available for reporting');
        }

        const socialMediaReportData: SocialMediaScamReportData = {
          platform: platform,
          content: socialData.caption,
          author_username: socialData.username,
          post_url: socialData.postUrl,
          author_followers_count: socialData.author_followers_count,
          engagement_metrics: socialData.engagement_metrics,
          risk_level: analysisResult.risk_level,
          analysis: analysisResult.analysis,
          recommended_action: analysisResult.recommended_action,
          text_analysis: undefined, // Could add if available
          image_analysis: undefined, // Could add if available
          multimodal: !!socialData.image,
          content_hash: undefined // Could add hash generation if needed
        };

        reportRequest = {
          scam_type: 'socialmedia',
          socialmedia_data: socialMediaReportData,
          user_comment: `Report submitted from mAIscam extension at ${new Date().toISOString()}`
        };
      } else {
        if (scamType === 'socialmedia') {
          throw new Error('No Facebook data available. Please scan a Facebook post first.');
        } else if (scamType === 'email') {
          throw new Error('No email data available. Please analyze an email first.');
        } else if (scamType === 'website') {
          throw new Error('No website data available. Please analyze a website first.');
        } else {
          throw new Error(`No data available for ${scamType} report`);
        }
      }

      console.log('📤 [SIDEBAR] Submitting report:', reportRequest);

      const reportResponse = await submitScamReport(reportRequest, 'EXTENSION_SIDEBAR_REPORT');
      
      if (reportResponse.success) {
        setReportSuccess(`${getReportText(selectedLanguage, 'successMessage')} ${reportResponse.data.report_id}`);
        console.log('✅ [SIDEBAR] Report submitted successfully:', reportResponse);
        
        // Store report status in background script
        const analysisData = scamType === 'email' ? extractedData : scamType === 'website' ? websiteData : scamType === 'socialmedia' ? (facebookData || twitterData) : null;
        browser.runtime.sendMessage({
          type: 'REPORT_SUBMITTED',
          analysisData,
          scamType,
          reportId: reportResponse.data.report_id
        }).catch((error) => {
          console.error('Failed to store report status in background:', error);
        });
        
        // Update local state to show reported status
        setAlreadyReported({ 
          reportId: reportResponse.data.report_id, 
          timestamp: Date.now() 
        });
        
      } else {
        throw new Error(reportResponse.message || 'Report submission failed');
      }

    } catch (error: any) {
      console.error('❌ [SIDEBAR] Report submission failed:', error);
      
      let errorMessage = 'Failed to submit report: ';
      if (error.message?.includes('Backend server is not responding')) {
        errorMessage += 'Cannot connect to backend server. Please ensure the server is running.';
      } else if (error.message?.includes('timed out')) {
        errorMessage += 'Request timed out. Please try again.';
      } else {
        errorMessage += (error.message || 'Unknown error');
      }
      
      setReportError(errorMessage);
    } finally {
      setReportLoading(false);
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
        // The extraction will continue even if the sidebar closes
        await browser.tabs.sendMessage(tabs[0].id, { type: 'START_FACEBOOK_EXTRACTION' });
        console.log('Facebook extraction started - sidebar can now be closed');
        
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

  const scanTwitterPost = async () => {
    // Check if extraction is already in progress
    if (twitterExtractionInProgress) {
      setError('Twitter extraction is already in progress. Please wait or cancel the current extraction.');
      return;
    }

    setLoading(true);
    setError(null);
    setTwitterData(null);
    setTwitterExtractionInProgress(true);

    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        // Check if we're on Twitter/X
        if (!tabs[0].url?.includes('twitter.com') && !tabs[0].url?.includes('x.com')) {
          setError('Please navigate to Twitter/X to use this feature.');
          return;
        }

        // Start Twitter post extraction (this will show the overlay and wait for user selection)
        // The extraction will continue even if the sidebar closes
        await browser.tabs.sendMessage(tabs[0].id, { type: 'START_TWITTER_EXTRACTION' });
        console.log('Twitter extraction started - sidebar can now be closed');

        // Start polling for completion
        pollForTwitterData(tabs[0].id);

      } else {
        setError('No active tab found.');
      }
    } catch (err: any) {
      console.error('Error starting Twitter extraction:', err);
      setError('Error starting Twitter extraction. Please try again.');
      setTwitterExtractionInProgress(false);
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-800 mb-2">mAIscam Extension</h1>
        <p className="text-sm text-gray-600">
          {scanMode === 'email' ? '📧 Email Analysis Mode (v2 - SEA-LION v4)' : 
           scanMode === 'website' ? '🌐 Website Analysis Mode (v2 - SEA-LION v4)' : 
           '📱 Social Media Mode (v2)'}
        </p>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {/* Scan Mode Selector */}
          {/* Auto-Detection Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🤖 Auto-Detected Site Type
            </label>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              {autoDetectedSite ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">
                      {scanMode === 'email' ? '📧' : scanMode === 'website' ? '🌐' : '👥'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getSiteTypeDisplayName(autoDetectedSite)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Confidence: {Math.round(autoDetectedSite.confidence * 100)}%
                        {autoDetectedSite.platform && ` • ${autoDetectedSite.platform}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleManualRedetect}
                      disabled={loading}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Manually redetect current site type"
                    >
                      🔄 Redetect
                    </button>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Auto-Detected
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-gray-500">
                  <span className="text-lg">🔍</span>
                  <p className="text-sm">Detecting site type...</p>
                </div>
              )}
            </div>
          </div>

          {/* Language Selector - show for all scanning modes */}
          {(scanMode === 'email' || scanMode === 'website' || scanMode === 'social') && (
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
          )}

          {/* Action Button */}
          <div className="space-y-2">
            <button
              onClick={
                scanMode === 'email' ? analyzeEmailForScam :
                scanMode === 'website' ? analyzeWebsiteForScam :
                autoDetectedSite?.platform === 'facebook' ? scanFacebookPost :
                autoDetectedSite?.platform === 'twitter' ? scanTwitterPost :
                scanFacebookPost  // Default fallback
              }
              disabled={loading}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading
                ? (scanMode === 'email' ? 'Analyzing Email...' :
                   scanMode === 'website' ? 'Analyzing Website...' :
                   autoDetectedSite?.platform === 'facebook' ? (facebookExtractionInProgress ? 'Waiting for Post Selection...' : 'Starting Facebook Extraction...') :
                   autoDetectedSite?.platform === 'twitter' ? (twitterExtractionInProgress ? 'Waiting for Post Selection...' : 'Starting Twitter Extraction...') :
                   'Starting Social Media Extraction...')
                : (scanMode === 'email' ? `🛡️ Analyze ${autoDetectedSite?.platform === 'gmail' ? 'Gmail Email' : 'Email'}` :
                   scanMode === 'website' ? '🛡️ Analyze Website' :
                   autoDetectedSite?.platform === 'facebook' ? '📱 Scan Facebook Post' :
                   autoDetectedSite?.platform === 'twitter' ? '🐦 Scan Twitter/X Post' :
                   '📱 Scan Social Media')
              }
            </button>
            
            {(extractedData || websiteData || facebookData || twitterData) && (
              <button
                onClick={() => {
                  setExtractedData(null);
                  setWebsiteData(null);
                  setFacebookData(null);
                  setTwitterData(null);
                  setFacebookExtractionInProgress(false);
                  setTwitterExtractionInProgress(false);
                  setError(null);
                  setAnalysisResult(null);
                  
                  // Clear report status when clearing results
                  setReportSuccess(null);
                  setReportError(null);
                  setReportLoading(false);
                  setAlreadyReported(null);
                  
                  // Clear stored analysis state and report status in background
                  browser.runtime.sendMessage({ type: 'CLEAR_ANALYSIS_STATE' }).catch(() => {});
                  browser.runtime.sendMessage({ type: 'CLEAR_REPORT_STATUS' }).catch(() => {});
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

          {/* Facebook Extraction Progress */}
          {facebookExtractionInProgress && !facebookData && (
            <div className="p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                <span className="font-semibold">Facebook Extraction in Progress</span>
              </div>
              <p className="text-sm">
                Please go to the Facebook tab and select a post. You can close this sidebar - we'll remember your selection!
              </p>
            </div>
          )}

          {/* Twitter Extraction Progress */}
          {twitterExtractionInProgress && !twitterData && (
            <div className="p-3 bg-sky-100 border border-sky-400 text-sky-700 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-sky-600 border-t-transparent"></div>
                <span className="font-semibold">Twitter Extraction in Progress</span>
              </div>
              <p className="text-sm">
                Please go to the Twitter/X tab and select a post. You can close this sidebar - we'll remember your selection!
              </p>
            </div>
          )}

          {/* Extracted Data Display - All removed for cleaner UI, data still extracted and logged to console */}

          {/* Report Section - Show only report functionality when medium/high risk is detected */}
          {analysisResult && (extractedData || websiteData || facebookData || twitterData) && shouldShowReportFunction(analysisResult) && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-red-600">📢</span>
                  <h3 className="font-semibold text-red-800">Report Scam to Authorities</h3>
                </div>
                
                <div className="text-center">
                  <p className="text-sm text-red-700 mb-3">
                    🚨 <strong>{getReportText(selectedLanguage, 'detected')}</strong> {alreadyReported ? '' : getReportText(selectedLanguage, 'question')}
                  </p>
                  
                  {alreadyReported ? (
                    <div className="space-y-2">
                      <div className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 cursor-not-allowed">
                        ✅ {getReportText(selectedLanguage, 'reported')}
                      </div>
                      <p className="text-xs text-green-700">
                        Report ID: {alreadyReported.reportId}
                        {alreadyReported.timestamp && (
                          <span className="block">
                            {getReportText(selectedLanguage, 'reportedAt')} {new Date(alreadyReported.timestamp).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubmitReport(scanMode === 'social' ? 'socialmedia' : scanMode as 'email' | 'website' | 'socialmedia')}
                      disabled={reportLoading}
                      className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {reportLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {getReportText(selectedLanguage, 'reporting')}
                        </>
                      ) : (
                        <>
                          📢 {getReportText(selectedLanguage, 'button')}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Report Status Messages */}
                {reportSuccess && (
                  <div className="bg-green-100 border border-green-300 rounded-lg p-3 mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✅</span>
                      <p className="text-sm text-green-700 font-medium">{getReportText(selectedLanguage, 'success')}</p>
                    </div>
                    <p className="text-xs text-green-600 mt-1">{reportSuccess}</p>
                  </div>
                )}

                {reportError && (
                  <div className="bg-red-100 border border-red-300 rounded-lg p-3 mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-red-600">❌</span>
                      <p className="text-sm text-red-700 font-medium">{getReportText(selectedLanguage, 'failed')}</p>
                    </div>
                    <p className="text-xs text-red-600 mt-1">{reportError}</p>
                    <button
                      onClick={() => handleSubmitReport(scanMode === 'social' ? 'socialmedia' : scanMode as 'email' | 'website' | 'socialmedia')}
                      disabled={reportLoading}
                      className="mt-2 text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {getReportText(selectedLanguage, 'tryAgain')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && !extractedData && !websiteData && !facebookData && !twitterData && (
              <div className="text-center text-gray-500 py-8">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <p className="text-sm font-medium mb-2">
                  {scanMode === 'email' ? 'Ready to analyze emails' : 
                   scanMode === 'website' ? 'Ready to analyze websites' : 
                   'Ready to scan social media posts'}
                </p>
                <p className="text-xs text-gray-400">
                  {scanMode === 'email'
                    ? 'Open an email in Gmail and click "Analyze Email" to check for threats'
                    : scanMode === 'website'
                    ? 'Navigate to any website and click "Analyze Website" to extract information'
                    : autoDetectedSite?.platform === 'facebook'
                    ? 'Navigate to Facebook and click "Scan Facebook Post" to extract post data'
                    : autoDetectedSite?.platform === 'twitter'
                    ? 'Navigate to Twitter/X and click "Scan Twitter Post" to extract post data'
                    : 'Navigate to a social media site (Facebook or Twitter) to scan posts'
                  }
                </p>
              </div>
          )}

          {/* Footer Instructions */}
          <div className="pt-4 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">
              {scanMode === 'email'
                ? 'Make sure you\'re on Gmail with an email open'
                : scanMode === 'website'
                ? 'Works on any website - just click scan to extract information'
                : autoDetectedSite?.platform === 'facebook'
                ? 'Make sure you\'re on Facebook viewing posts'
                : autoDetectedSite?.platform === 'twitter'
                ? 'Make sure you\'re on Twitter/X viewing posts'
                : 'Make sure you\'re on Facebook or Twitter/X viewing posts'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;