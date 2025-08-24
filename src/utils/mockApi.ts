// Mock API for scam analysis - FOR REFERENCE ONLY
// These interfaces and mock data are kept for documentation purposes
// The actual implementation is now in backendApi.ts
export interface MockAnalysisRequest {
  title: string;
  content: string;
  from_email: string;
  target_language: string;
}

export interface MockAnalysisResponse {
  code: number;
  message: string;
  success: boolean;
  data: {
    email_id: string;
    [languageCode: string]: {
      risk_level: string;
      analysis: string;
      recommended_action: string;
    } | string;
  };
}

// Generate a random email ID
function generateEmailId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Mock responses for different languages
const MOCK_RESPONSES: Record<string, { risk_level: string; analysis: string; recommended_action: string }> = {
  en: {
    risk_level: 'High',
    analysis: 'This email exhibits clear phishing characteristics, including urgent language, requests for account information through unofficial links, and fake banking domains. The link \'bankn3gara.xyz\' is clearly fraudulent and poses high risk.',
    recommended_action: 'Do not click any links and report this email to the relevant bank through official channels.'
  },
  ms: {
    risk_level: 'Tinggi',
    analysis: 'E-mel ini menunjukkan ciri-ciri phishing yang jelas, termasuk bahasa mendesak, permintaan maklumat akaun melalui pautan tidak rasmi, dan domain bank palsu. Pautan \'bankn3gara.xyz\' jelas palsu dan berisiko tinggi.',
    recommended_action: 'Jangan klik sebarang pautan dan laporkan e-mel ini kepada bank berkaitan melalui saluran rasmi.'
  },
  zh: {
    risk_level: '高',
    analysis: '该邮件存在明显的钓鱼特征，包括紧迫语气、要求通过非官方链接提供账户信息，以及伪造的马来西亚国家银行域名。链接\'bankn3gara.xyz\'是明显的仿冒，存在高风险。',
    recommended_action: '勿点击链接并通过官方渠道向马来西亚国家银行报告。'
  },
  vi: {
    risk_level: 'Cao',
    analysis: 'Email này thể hiện các đặc điểm lừa đảo rõ ràng, bao gồm ngôn ngữ khẩn cấp, yêu cầu thông tin tài khoản qua liên kết không chính thức và tên miền ngân hàng giả. Liên kết \'bankn3gara.xyz\' rõ ràng là giả mạo và có rủi ro cao.',
    recommended_action: 'Không nhấp vào bất kỳ liên kết nào và báo cáo email này cho ngân hàng liên quan qua kênh chính thức.'
  },
  th: {
    risk_level: 'สูง',
    analysis: 'อีเมลนี้แสดงลักษณะการฟิชชิ่งอย่างชัดเจน รวมถึงภาษาเร่งด่วน การขอข้อมูลบัญชีผ่านลิงก์ที่ไม่เป็นทางการ และโดเมนธนาคารปลอม ลิงก์ \'bankn3gara.xyz\' เป็นการปลอมแปลงอย่างชัดเจนและมีความเสี่ยงสูง',
    recommended_action: 'อย่าคลิกลิงก์ใดๆ และรายงานอีเมลนี้ไปยังธนาคารที่เกี่ยวข้องผ่านช่องทางอย่างเป็นทางการ'
  },
  fil: {
    risk_level: 'Mataas',
    analysis: 'Ang email na ito ay nagpapakita ng mga malinaw na katangian ng phishing, kasama ang mabiligang wika, mga kahilingan para sa impormasyon ng account sa pamamagitan ng mga hindi opisyal na link, at mga pekeng banking domain. Ang link na \'bankn3gara.xyz\' ay malinaw na peke at may mataas na panganib.',
    recommended_action: 'Huwag mag-click sa anumang mga link at iulat ang email na ito sa kaukulang bangko sa pamamagitan ng mga opisyal na channel.'
  },
  id: {
    risk_level: 'Tinggi',
    analysis: 'Email ini menunjukkan karakteristik phishing yang jelas, termasuk bahasa mendesak, permintaan informasi akun melalui tautan tidak resmi, dan domain perbankan palsu. Tautan \'bankn3gara.xyz\' jelas palsu dan berisiko tinggi.',
    recommended_action: 'Jangan klik tautan apa pun dan laporkan email ini ke bank terkait melalui saluran resmi.'
  },
  jv: {
    risk_level: 'Dhuwur',
    analysis: 'Email iki nuduhake karakteristik phishing sing jelas, kalebu basa sing cepet-cepet, panjaluk informasi akun liwat tautan ora resmi, lan domain perbankan palsu. Tautan \'bankn3gara.xyz\' jelas palsu lan duwe risiko dhuwur.',
    recommended_action: 'Aja ngeklik tautan apa wae lan laporake email iki menyang bank sing gegayutan liwat saluran resmi.'
  },
  su: {
    risk_level: 'Luhur',
    analysis: 'Email ieu nunjukkeun karakteristik phishing anu jelas, kaasup basa anu gancang, paménta inpormasi akun ngaliwatan tautan anu teu resmi, jeung domain perbankan palsu. Tautan \'bankn3gara.xyz\' jelas palsu jeung boga resiko luhur.',
    recommended_action: 'Ulah ngaklik tautan naon waé jeung laporkeun email ieu ka bank anu patali ngaliwatan saluran resmi.'
  },
  km: {
    risk_level: 'ខ្ពស់',
    analysis: 'អ៊ីមែលនេះបង្ហាញពីលក្ខណៈពិសេសនៃការលួចព័ត៌មានយ៉ាងច្បាស់ រួមទាំងភាសាបន្ទាន់ ការស្នើសុំព័ត៌មានគណនីតាមរយៈតំណមិនផ្លូវការ និងដែនធនាគារក្លែងក្លាយ។ តំណ \'bankn3gara.xyz\' ច្បាស់ជាក្លែងក្លាយ និងមានហានិភ័យខ្ពស់។',
    recommended_action: 'កុំចុចតំណណាមួយ និងរាយការណ៍អ៊ីមែលនេះទៅធនាគារពាក់ព័ន្ធតាមរយៈបណ្តាញផ្លូវការ។'
  },
  lo: {
    risk_level: 'ສູງ',
    analysis: 'ອີເມວນີ້ສະແດງໃຫ້ເຫັນລັກສະນະການລັກລອບຂໍ້ມູນທີ່ຊັດເຈນ ລວມທັງພາສາເຮັດໃຫ້ເສົ້າ ການຂໍຂໍ້ມູນບັນຊີຜ່ານລິ້ງທີ່ບໍ່ເປັນທາງການ ແລະໂດເມນທະນາຄານປອມ. ລິ້ງ \'bankn3gara.xyz\' ແມ່ນປະຈະວ່າປອມ ແລະມີຄວາມສ່ຽງສູງ.',
    recommended_action: 'ຢ່າກົດລິ້ງໃດໆ ແລະລາຍງານອີເມວນີ້ໃຫ້ທະນາຄານທີ່ກ່ຽວຂ້ອງຜ່ານຊ່ອງທາງຢ່າງເປັນທາງການ.'
  },
  my: {
    risk_level: 'မြင့်',
    analysis: 'ဤအီးမေးလ်သည် ရှင်းလင်းသော ဖစ်ရှင်း လက္ခဏာများကို ပြသနေပြီး၊ အရေးပေါ်ဘာသာစကား၊ တရားဝင်မဟုတ်သော လင့်များမှတစ်ဆင့် အကောင့်အချက်အလက်များ တောင်းခံခြင်း၊ နှင့် အတုဘဏ်ဒိုမိန်းများ ပါဝင်ပါသည်။ \'bankn3gara.xyz\' လင့်သည် ရှင်းရှင်းလင်းလင်း အတုဖြစ်ပြီး အန္တရာယ်မြင့်မားပါသည်။',
    recommended_action: 'မည်သည့်လင့်ကိုမျှ မနှိပ်ပါနှင့် ဤအီးမေးလ်ကို တရားဝင်ချန်နယ်များမှတစ်ဆင့် သက်ဆိုင်သောဘဏ်သို့ သတင်းပို့ပါ။'
  },
  ta: {
    risk_level: 'உயர்',
    analysis: 'இந்த மின்னஞ்சல் தெளிவான ஃபிஷிங் பண்புகளை வெளிப்படுத்துகிறது, அவசர மொழி, அதிகாரப்பூர்வமற்ற இணைப்புகள் மூலம் கணக்கு தகவல்களுக்கான கோரிக்கைகள் மற்றும் போலி வங்கி டொமைன்கள் உட்பட. \'bankn3gara.xyz\' இணைப்பு தெளிவாக மோசடியானது மற்றும் அதிக ஆபத்தை ஏற்படுத்துகிறது.',
    recommended_action: 'எந்த இணைப்புகளையும் கிளிக் செய்யாதீர்கள் மற்றும் இந்த மின்னஞ்சலை அதிகாரப்பூர்வ சேனல்கள் மூலம் தொடர்புடைய வங்கிக்கு புகாரளிக்கவும்.'
  }
};

// Note: analyzeEmail function has been moved to backendApi.ts to avoid duplicate exports
// The mock responses above are kept for reference and potential future use
// These interfaces are renamed to avoid conflicts with backendApi.ts
