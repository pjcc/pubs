const TAG_ICONS = {
  'garden': '🌿',
  'terrace': '☀️',
  'covered outdoor': '🏠',
  'heaters': '🔥',
  'dog friendly': '🐕',
  'pubbl': '📱',
  'live music': '🎵',
  'cocktails': '🍸',
  'real ale': '🍺',
  'sports tv': '📺',
  'rooftop': '🏙️',
  'seafront': '🌊',
  'quiz night': '❓',
  'sunday roast': '🍖',
  'late night': '🌙',
  'cosy': '🪵',
  'family friendly': '👨‍👩‍👧',
  'wheelchair accessible': '♿',
  'reservable': '📋',
  'vegetarian options': '🥬',
  'wine bar': '🍷',
  'chilled reds': '🍷',
  'old man': '👴',
  'late sun': '🌅',
};

export default TAG_ICONS;

export function getTagIcon(name) {
  return TAG_ICONS[String(name).toLowerCase()] || null;
}
