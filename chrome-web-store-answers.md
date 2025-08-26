# Chrome Web Store Submission Answers

## Single Purpose Description
```
mAIscam is a scam detection extension that analyzes emails, websites, and social media posts to identify potential scams and phishing attempts. The extension extracts content from web pages (Gmail, websites, Facebook), sends it to a scam analysis API, and provides users with risk assessments and safety recommendations in multiple Southeast Asian languages.
```

## Permission Justifications

### activeTab justification
```
Required to access and analyze content from the currently active tab for scam detection. The extension needs to read webpage content, email text, and social media posts to perform security analysis and provide scam risk assessments to users.
```

### tabs justification
```
Required to capture screenshots of websites for visual analysis and to interact with multiple tabs during the scam detection process. Screenshots help identify visual scam indicators like fake login pages or suspicious website layouts.
```

### scripting justification
```
Required to inject content scripts into web pages to extract data for scam analysis. The extension needs to programmatically access email content from Gmail, website metadata, and Facebook posts to analyze them for potential scam indicators.
```

### storage justification
```
Required to store API keys for backend authentication and cache user preferences. The extension stores authentication tokens locally to maintain secure connections with the scam analysis API and remember user language preferences.
```

### Host permission justification
```
Gmail access (*://mail.google.com/*) is required to extract email content for scam analysis. Broad web permissions (http://*/* and https://*/*) are required because the extension analyzes any website for scam indicators - users can scan any webpage they visit for potential security threats. This wide access is essential for comprehensive scam protection across all websites.
```

## Remote Code Usage
**Answer:** No, I am not using Remote code

## Data Usage

**What user data do you plan to collect from users now or in the future?**

☐ Personally identifiable information  
☐ Health information  
☐ Financial and payment information  
☐ Authentication information  
☐ Personal communications  
☐ Location  
☐ Web history  
☐ User activity  
☑ **Website content** - For analyzing text, images, sounds, videos or hyperlinks to detect scams

## Certifications
☑ I do not sell or transfer user data to third parties, apart from the approved use cases  
☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose  
☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

## Privacy Policy Template

**You need to create a privacy policy and host it at a public URL. Here's a template:**

```markdown
# mAIscam Extension Privacy Policy

Last updated: [DATE]

## Overview
mAIscam is a browser extension that helps protect users from online scams by analyzing website content, emails, and social media posts for potential threats.

## Data Collection
We collect and process the following types of data:
- **Website Content**: Text, images, and metadata from web pages you choose to analyze
- **Email Content**: Email text from Gmail when you request scam analysis
- **Social Media Posts**: Facebook post content when you select posts for analysis
- **Technical Data**: API authentication keys stored locally in your browser

## How We Use Your Data
- Analyze content through our secure scam detection API
- Provide real-time risk assessments and safety recommendations
- Maintain secure authentication with our analysis servers
- Support multiple Southeast Asian languages for localized protection

## Data Storage and Retention
- **Local Storage**: Only API keys are stored locally in your browser
- **Temporary Processing**: Content is processed temporarily for analysis only
- **No Permanent Storage**: We do not permanently store your emails, posts, or browsing content
- **User Control**: You can clear all stored data by removing the extension

## Data Sharing
- We do not sell, rent, or share your personal data with third parties
- Content is only processed by our secure scam detection API
- Analysis is performed solely for security purposes
- No data is used for advertising or marketing

## Security
- All data transmission uses secure HTTPS connections
- API keys are stored locally and encrypted
- Content analysis is performed on secure servers
- We follow industry-standard security practices

## Your Rights
- **Access**: You control what content to analyze
- **Deletion**: Remove the extension to clear all local data
- **Transparency**: This policy explains our data practices clearly
- **Contact**: Reach out with any privacy concerns

## Changes to This Policy
We may update this privacy policy as needed. Continued use of the extension constitutes acceptance of any changes.

## Contact Information
For privacy questions or concerns: [YOUR-EMAIL-ADDRESS]
Extension Website: [YOUR-WEBSITE-URL]
```

**Where to host your privacy policy:**
1. GitHub Pages: `https://username.github.io/privacy-policy`
2. Your personal website: `https://yourdomain.com/privacy`
3. Google Sites (free)
4. Any public web hosting service

**Privacy Policy URL field:** Enter the full URL where you host the policy above.