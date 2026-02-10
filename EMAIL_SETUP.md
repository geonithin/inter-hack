# Email Form Setup Instructions

The Quick Message form on the landing page is now configured to send emails to **geonithinj@gmail.com**.

## How to Get Your Own Access Key (Free):

1. **Go to [Web3Forms.com](https://web3forms.com/)**
2. **Enter your email** (geonithinj@gmail.com)
3. **Click "Create Access Key"**
4. **Copy the access key** you receive via email
5. **Replace the demo key** in `src/pages/Landing.jsx`:

```javascript
access_key: 'YOUR_ACTUAL_KEY_HERE', // Replace this line
```

## Current Setup:

- ✅ Form has improved UI with gradient background
- ✅ Loading state with spinner animation
- ✅ Success/error message display
- ✅ Form validation
- ✅ Automatic email sending to geonithinj@gmail.com
- ✅ Professional styling with icons

## Features:

- **Gradient Background**: Modern oxford gradient design
- **Icon Header**: Send icon with title
- **Loading Spinner**: Shows while sending
- **Success Notification**: Green banner on successful send
- **Error Handling**: Red banner with fallback email link
- **Disabled State**: Form disables during submission
- **Form Reset**: Clears after successful submission

## Testing:

The form currently uses a demo access key. For production use, replace it with your own key from Web3Forms (it's completely free, no credit card required).
