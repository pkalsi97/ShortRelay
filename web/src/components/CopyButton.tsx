import React from 'react';
import { toast } from 'react-hot-toast';

// Define the props type for the CopyButton component
interface CopyButtonProps {
  url: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ url }) => {
  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        toast.success('URL copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy: ', err);
        toast.error('Failed to copy URL');
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';   // Move it out of view
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('URL copied to clipboard');
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        toast.error('Failed to copy URL');
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <button
      onClick={() => copyToClipboard(url)}
      className="text-purple-500 hover:text-purple-400 text-sm flex items-center gap-2"
    >
      Copy
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
      </svg>
    </button>
  );
};

export default CopyButton;