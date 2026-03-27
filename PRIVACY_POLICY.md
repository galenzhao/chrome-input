## Privacy Policy — Input Improve Helper

**Effective date:** 2026-03-27

Input Improve Helper ("we", "our") is a Chrome extension that helps you improve text you type in web page input areas by sending that text to an AI API endpoint **you configure**.

### Summary

- **We do not run any backend servers** for this extension.
- **We do not sell or share data** for advertising.
- **Text you choose to optimize is sent to your configured API provider** (for example, OpenAI or an OpenAI-compatible provider you set in Options).
- **Your API key and settings are stored locally** in your browser’s extension storage.

### Data we collect

The extension itself does **not** collect data to a developer-controlled server. However, the extension processes the following data to provide its functionality:

- **User-provided text content**: When you click optimize, the extension reads the current text from the focused input/textarea/contenteditable/editor and sends it to your configured API endpoint to generate an improved version.
- **API configuration**: Base URL, API key, preferred model, and your saved prompts/modes.
- **Usage statistics**: Token usage totals and last-call usage (if returned by your API provider), stored locally.

### How we use data

- **To provide the service**: Send your selected text to the configured API endpoint and replace the input with the result.
- **To persist your settings**: Save your configuration, prompts, UI placement, and usage stats in local extension storage.

### Data sharing / third parties

When you use the extension, your text is transmitted to the third-party API provider you configure (and any infrastructure they use). Their handling of your data is governed by **their** privacy policy and terms.

We do not otherwise disclose data to third parties, and we do not use data for advertising.

### Data storage and retention

- **Local storage**: Configuration, prompts/modes, UI settings, and usage stats are stored in `chrome.storage.local` on your device until you remove them (e.g., via uninstalling the extension or clearing extension data).
- **Remote retention**: Any retention of your requests/responses by your API provider depends on that provider.

### Security

The extension stores your API key in Chrome extension storage on your device. Please treat your API key as sensitive, and consider using a restricted key if your provider supports it.

### Children’s privacy

This extension is not directed to children under 13, and we do not knowingly collect personal information from children.

### Changes to this policy

We may update this policy from time to time. Updates will be posted at this same URL/page with a revised effective date.

### Contact

If you have questions about this privacy policy, contact:

- **Email:** tos@zhenggangzhao.org

