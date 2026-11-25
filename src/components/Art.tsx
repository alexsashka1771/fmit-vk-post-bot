export function OrbitalArt({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 360 310" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="heroGlow"><stop stopColor="#C7B3FF" stopOpacity=".8" /><stop offset="1" stopColor="#D8CAFF" stopOpacity="0" /></radialGradient>
      <linearGradient id="heroSphere" x1="90" y1="70" x2="270" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#9576ED" /><stop offset=".5" stopColor="#7045D5" /><stop offset="1" stopColor="#2E2263" /></linearGradient>
      <linearGradient id="ribbon" x1="40" y1="80" x2="300" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor="#C0B5EC" /><stop offset=".52" stopColor="#8C6CDE" /><stop offset="1" stopColor="#CDC4E9" /></linearGradient>
    </defs>
    <circle cx="175" cy="156" r="150" fill="url(#heroGlow)" />
    <ellipse cx="177" cy="158" rx="154" ry="66" transform="rotate(-28 177 158)" stroke="#B7A8DE" strokeWidth="1.5" strokeDasharray="4 6" />
    <circle cx="177" cy="158" r="77" fill="url(#heroSphere)" />
    <g stroke="#BCABEA" strokeWidth="1" opacity=".6"><ellipse cx="177" cy="158" rx="77" ry="32" transform="rotate(-18 177 158)" /><ellipse cx="177" cy="158" rx="32" ry="77" transform="rotate(24 177 158)" /><ellipse cx="177" cy="158" rx="55" ry="77" transform="rotate(24 177 158)" /><path d="M110 132c40-19 94-24 137-9M103 156c45-14 103-20 149-12M111 193c43-12 83-21 139-17" /></g>
    <path d="M50 143c-15 39 44 69 133 58 88-12 143-47 125-74" stroke="url(#ribbon)" strokeWidth="18" />
    <path d="M50 143c-15 39 44 69 133 58 88-12 143-47 125-74" stroke="#DBD3EF" strokeWidth="1.5" />
    <rect x="255" y="52" width="42" height="42" rx="10" transform="rotate(12 255 52)" fill="#D8F0B3" />
    <path d="M266 66l15 13m-13 4 11-21" stroke="#4E6741" strokeWidth="2" />
    <circle cx="53" cy="221" r="8" fill="#8C6ADE" /><circle cx="307" cy="196" r="5" fill="#A891D9" />
    <path d="M68 72v20m-10-10h20M281 247v14m-7-7h14" stroke="#9380C5" strokeWidth="1.5" />
    <path d="M106 255h52" stroke="#D0C7E4" strokeWidth="1.5" />
    <text x="47" y="127" fontFamily="Georgia, serif" fontSize="30" fill="#8F77BD">∑</text>
    <text x="275" y="228" fontFamily="Georgia, serif" fontSize="29" fill="#8F77BD">x²</text>
  </svg>;
}

export function CoverArt() {
  return <svg className="cover-art" viewBox="0 0 260 280" fill="none" aria-hidden="true">
    <ellipse cx="142" cy="143" rx="92" ry="112" transform="rotate(-31 142 143)" stroke="currentColor" strokeWidth="1.1" />
    <ellipse cx="142" cy="143" rx="57" ry="112" transform="rotate(33 142 143)" stroke="currentColor" strokeWidth=".8" opacity=".6" />
    <ellipse cx="142" cy="143" rx="113" ry="35" transform="rotate(-31 142 143)" stroke="currentColor" strokeWidth=".8" opacity=".6" />
    <path d="M92 78l69-8 31 61-30 70-67 1-33-63zM92 78l70 123M161 70l-66 132M62 139l130-8" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="62" cy="139" r="4.5" fill="#C9FE84" /><circle cx="162" cy="201" r="3" fill="white" />
  </svg>;
}

export function VkMark({ small = false }: { small?: boolean }) {
  return <span className={`vk-mark ${small ? 'vk-mark-small' : ''}`} aria-label="ВКонтакте">vk</span>;
}
