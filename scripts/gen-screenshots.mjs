/**
 * Generates PWA install-UI screenshots for the manifest.
 * Run once (or after major UI changes): node scripts/gen-screenshots.mjs
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const pub   = join(__dir, '..', 'public');

/* ── Wide  1280 × 720 (desktop) ─────────────────────────────────── */
const wideSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#5ba8d4"/>
      <stop offset="48%"  stop-color="#5BB85B"/>
      <stop offset="78%"  stop-color="#2d5a27"/>
      <stop offset="100%" stop-color="#1a3a15"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="rgba(10,40,8,0.78)"/>
      <stop offset="100%" stop-color="rgba(5,20,4,0.88)"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1280" height="720" fill="url(#sky)"/>
  <!-- Ground -->
  <rect y="620" width="1280" height="100" fill="#174512"/>
  <rect y="615" width="1280" height="12" fill="#2d7a22" opacity="0.6"/>

  <!-- Decorative dino silhouettes (left) -->
  <ellipse cx="160" cy="590" rx="90" ry="55" fill="#2d7a22" opacity="0.8"/>
  <path d="M100 590 Q105 545 118 528 Q130 512 140 528 Q132 554 128 590 Z" fill="#2d7a22" opacity="0.8"/>
  <ellipse cx="118" cy="520" rx="26" ry="20" fill="#2d7a22" opacity="0.8"/>
  <polygon points="122,502 130,472 138,502" fill="#FFD700" opacity="0.85"/>
  <polygon points="136,498 144,467 152,498" fill="#FFD700" opacity="0.85"/>
  <polygon points="150,500 157,472 164,500" fill="#FFAA00" opacity="0.85"/>

  <!-- Decorative dino silhouettes (right) -->
  <ellipse cx="1120" cy="590" rx="90" ry="55" fill="#2d7a22" opacity="0.8"/>
  <path d="M1180 590 Q1175 545 1162 528 Q1150 512 1140 528 Q1148 554 1152 590 Z" fill="#2d7a22" opacity="0.8"/>
  <ellipse cx="1162" cy="520" rx="26" ry="20" fill="#2d7a22" opacity="0.8"/>
  <polygon points="1128,502 1136,472 1144,502" fill="#FFD700" opacity="0.85"/>
  <polygon points="1142,498 1150,467 1158,498" fill="#FFD700" opacity="0.85"/>
  <polygon points="1110,500 1117,472 1124,500" fill="#FFAA00" opacity="0.85"/>

  <!-- Central card -->
  <rect x="320" y="140" width="640" height="400" rx="28" fill="url(#card)"/>
  <rect x="320" y="140" width="640" height="400" rx="28" fill="none"
        stroke="rgba(255,215,0,0.22)" stroke-width="2"/>

  <!-- Title text -->
  <text x="640" y="270" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="68"
        fill="#FFD700" stroke="#c96a00" stroke-width="3" paint-order="stroke">Dino Party Pad</text>

  <!-- Tagline -->
  <text x="640" y="328" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.88)">
    The roar-some party game for families
  </text>

  <!-- Player token dots -->
  <circle cx="530" cy="400" r="22" fill="#f44336"/>
  <circle cx="590" cy="400" r="22" fill="#2196F3"/>
  <circle cx="650" cy="400" r="22" fill="#4CAF50"/>
  <circle cx="710" cy="400" r="22" fill="#FF9800"/>

  <!-- "1-4 Players" label -->
  <rect x="480" y="436" width="320" height="44" rx="22" fill="rgba(255,255,255,0.10)"/>
  <text x="640" y="463" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white">
    1 – 4 Players  ·  4 Mini-Games  ·  Works Offline
  </text>

  <!-- Dice icon -->
  <rect x="360" y="380" width="56" height="56" rx="12" fill="white" opacity="0.92"/>
  <circle cx="375" cy="395" r="5" fill="#333"/>
  <circle cx="394" cy="395" r="5" fill="#333"/>
  <circle cx="375" cy="413" r="5" fill="#333"/>
  <circle cx="394" cy="413" r="5" fill="#333"/>
  <circle cx="384" cy="404" r="5" fill="#333"/>

  <!-- Trophy icon -->
  <path d="M856 378 L856 414 Q876 426 896 414 L896 378 Z" fill="#FFD700" opacity="0.92"/>
  <rect x="868" y="414" width="14" height="12" fill="#FFD700" opacity="0.92"/>
  <rect x="860" y="426" width="30" height="5" rx="2" fill="#FFD700" opacity="0.92"/>
  <path d="M856 382 Q842 382 842 396 Q842 408 856 410" fill="none" stroke="#FFD700" stroke-width="6" opacity="0.8"/>
  <path d="M896 382 Q910 382 910 396 Q910 408 896 410" fill="none" stroke="#FFD700" stroke-width="6" opacity="0.8"/>

  <!-- Clouds -->
  <ellipse cx="960" cy="90" rx="70" ry="30" fill="white" opacity="0.35"/>
  <ellipse cx="1010" cy="80" rx="50" ry="25" fill="white" opacity="0.35"/>
  <ellipse cx="300"  cy="110" rx="60" ry="26" fill="white" opacity="0.30"/>
  <ellipse cx="250"  cy="100" rx="45" ry="20" fill="white" opacity="0.30"/>
</svg>`.trim();

/* ── Narrow  540 × 960 (mobile) ─────────────────────────────────── */
const narrowSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960">
  <defs>
    <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#5ba8d4"/>
      <stop offset="50%"  stop-color="#5BB85B"/>
      <stop offset="80%"  stop-color="#2d5a27"/>
      <stop offset="100%" stop-color="#1a3a15"/>
    </linearGradient>
    <linearGradient id="card2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="rgba(10,40,8,0.80)"/>
      <stop offset="100%" stop-color="rgba(5,20,4,0.90)"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="540" height="960" fill="url(#sky2)"/>
  <!-- Ground -->
  <rect y="840" width="540" height="120" fill="#174512"/>
  <rect y="834" width="540" height="12" fill="#2d7a22" opacity="0.6"/>

  <!-- Clouds -->
  <ellipse cx="420" cy="80"  rx="60" ry="26" fill="white" opacity="0.35"/>
  <ellipse cx="460" cy="68"  rx="40" ry="20" fill="white" opacity="0.35"/>
  <ellipse cx="110" cy="100" rx="55" ry="22" fill="white" opacity="0.30"/>

  <!-- Dino silhouette (left bottom) -->
  <ellipse cx="90"  cy="856" rx="72" ry="44" fill="#2d7a22" opacity="0.85"/>
  <path d="M40 856 Q44 820 55 806 Q66 792 74 806 Q68 828 66 856 Z" fill="#2d7a22" opacity="0.85"/>
  <ellipse cx="56" cy="799" rx="20" ry="16" fill="#2d7a22" opacity="0.85"/>
  <polygon points="60,785 67,762 74,785" fill="#FFD700" opacity="0.85"/>
  <polygon points="72,782 79,758 86,782" fill="#FFD700" opacity="0.85"/>

  <!-- Dino silhouette (right bottom) -->
  <ellipse cx="450" cy="856" rx="72" ry="44" fill="#2d7a22" opacity="0.85"/>
  <path d="M500 856 Q496 820 485 806 Q474 792 466 806 Q472 828 474 856 Z" fill="#2d7a22" opacity="0.85"/>
  <ellipse cx="484" cy="799" rx="20" ry="16" fill="#2d7a22" opacity="0.85"/>
  <polygon points="454,785 461,762 468,785" fill="#FFD700" opacity="0.85"/>
  <polygon points="466,782 473,758 480,782" fill="#FFAA00" opacity="0.85"/>

  <!-- Central card -->
  <rect x="40" y="220" width="460" height="530" rx="28" fill="url(#card2)"/>
  <rect x="40" y="220" width="460" height="530" rx="28" fill="none"
        stroke="rgba(255,215,0,0.22)" stroke-width="2"/>

  <!-- App icon inside card -->
  <rect x="195" y="260" width="150" height="150" rx="35" fill="#1f5c18"/>
  <rect x="195" y="260" width="150" height="150" rx="35" fill="none"
        stroke="rgba(255,215,0,0.3)" stroke-width="2"/>
  <!-- Mini dino in icon -->
  <ellipse cx="290" cy="374" rx="48" ry="32" fill="#4CAF50"/>
  <path d="M252 374 Q250 348 258 336 Q266 324 272 334 Q268 352 266 374 Z" fill="#4CAF50"/>
  <ellipse cx="262" cy="328" rx="18" ry="14" fill="#4CAF50"/>
  <polygon points="266,316 272,298 278,316" fill="#FFD700"/>
  <polygon points="278,314 284,296 290,314" fill="#FFD700"/>
  <polygon points="290,316 295,300 300,316" fill="#FFAA00"/>

  <!-- Title -->
  <text x="270" y="466" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="46"
        fill="#FFD700" stroke="#c96a00" stroke-width="2" paint-order="stroke">Dino Party</text>
  <text x="270" y="518" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="46"
        fill="#FFD700" stroke="#c96a00" stroke-width="2" paint-order="stroke">Pad</text>

  <!-- Tagline -->
  <text x="270" y="566" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.85)">
    Roar together, play together!
  </text>

  <!-- Player tokens -->
  <circle cx="174" cy="624" r="20" fill="#f44336"/>
  <circle cx="224" cy="624" r="20" fill="#2196F3"/>
  <circle cx="316" cy="624" r="20" fill="#4CAF50"/>
  <circle cx="366" cy="624" r="20" fill="#FF9800"/>

  <!-- Feature pills -->
  <rect x="80"  y="662" width="170" height="38" rx="19" fill="rgba(255,255,255,0.12)"/>
  <text x="165" y="685" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="16" fill="white">1–4 Players</text>

  <rect x="290" y="662" width="170" height="38" rx="19" fill="rgba(255,255,255,0.12)"/>
  <text x="375" y="685" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="16" fill="white">Works Offline</text>

  <rect x="80"  y="710" width="170" height="38" rx="19" fill="rgba(255,255,255,0.12)"/>
  <text x="165" y="733" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="16" fill="white">4 Mini-Games</text>

  <rect x="290" y="710" width="170" height="38" rx="19" fill="rgba(255,255,255,0.12)"/>
  <text x="375" y="733" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="16" fill="white">Free to Play</text>
</svg>`.trim();

await sharp(Buffer.from(wideSvg))
  .resize(1280, 720)
  .png()
  .toFile(join(pub, 'screenshot-wide.png'));
console.log('✓ screenshot-wide.png  (1280×720  desktop)');

await sharp(Buffer.from(narrowSvg))
  .resize(540, 960)
  .png()
  .toFile(join(pub, 'screenshot-narrow.png'));
console.log('✓ screenshot-narrow.png  (540×960  mobile)');

console.log('All screenshots generated!');
