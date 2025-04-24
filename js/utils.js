// js/utils.js (उदाहरण)

export function formatTimeAgo(date) {
  if (!(date instanceof Date)) return '';
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return Math.floor(seconds) + "s ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 30) return days + "d ago";
   const months = Math.floor(days / 30);
  if (months < 12) return months + "mo ago";
  const years = Math.floor(days / 365);
  return years + "y ago";
}

// Add other utility functions here if needed