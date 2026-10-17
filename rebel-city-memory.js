// Compact civil architecture. Visual variants share the existing building cell and health.
export function cityVariation(kind){
 const wall='var(--city-wall)',side='var(--city-side)',roof='var(--city-roof)';
 const shell=`<path d="M-51 25H58L67 32H-45Z" fill="#202d29" opacity=".17"/><path d="M-48-21H46V27H-48Z" fill="${wall}"/><path d="M46-21L59-31V17L46 27Z" fill="${side}"/><path d="M-48-21L-35-31H59L46-21Z" fill="${roof}"/>`;
 let detail='';
 if(kind==='shops')detail=`<path d="M-44-9H42V2H-44Z" fill="#657e78"/><path d="M-43-8H-31V1H-43ZM-19-8H-7V1H-19ZM5-8H17V1H5ZM29-8H41V1H29Z" fill="#d3c2a0"/><path d="M-39 6H-17V24H-39ZM-11 6H11V24H-11ZM17 6H38V24H17Z" fill="#465756"/><path d="M-40-16H38" stroke="#e5d5b5" stroke-width="3"/><path d="M-26 8V23M0 8V23M28 8V23" stroke="#b9b49e"/>`;
 else if(kind==='school')detail=`<path d="M-40-13H-27V-2H-40ZM-20-13H-7V-2H-20ZM11-13H24V-2H11ZM31-13H42V-2H31Z" fill="#536662"/><path d="M-39 8H-25V20H-39ZM-19 8H-7V20H-19ZM12 8H25V20H12ZM32 8H43V20H32Z" fill="#62746e"/><path d="M-3 5H8V27H-3Z" fill="#424d46"/><path d="M-9 4H13L8-2H-4Z" fill="${roof}"/><path d="M-13-26V-43H14V-26Z" fill="${wall}"/><circle cy="-34" r="6" fill="#e4d8b8"/><path d="M0-38V-34L4-32" fill="none" stroke="#535c52"/>`;
 else detail=`<path d="M-45-17H-17V24H-45ZM15-17H43V24H15Z" fill="${wall}"/><path d="M-17-13H15V18H-17Z" fill="#748478"/><path d="M-17 18L-8 11H15V27H-17Z" fill="#a3977c"/><path d="M-37-8H-28V2H-37ZM25-8H34V2H25ZM-37 10H-28V22H-37ZM25 10H34V22H25Z" fill="#53605a"/><path d="M-5 14H6V27H-5Z" fill="#4a544b"/><path d="M-20-18L-10-27H26L15-18Z" fill="${roof}"/>`;
 return `<g stroke="#54594f" stroke-width="1.7" stroke-linejoin="round">${shell}${detail}</g>`;
}
export function ruinArtwork(type,seed=0){
 const tall=type==='apartment',h=tall?58:type==='cityHall'?42:28,w=tall?34:49,flip=seed%2?-1:1;
 return `<g transform="scale(${flip} 1)" stroke-linejoin="round"><ellipse cy="27" rx="61" ry="16" fill="#2d302b" opacity=".23"/>
 <path d="M-${w} 27L-${w-9} 15H${w}L${w+13} 27L35 36H-37Z" fill="#716b5b" stroke="#4e544b" stroke-width="2"/>
 <path d="M-${w} 26V-${h}L-${w-11}-${h-7}L-${w-17}-${h+5}L-${w-25}-${h-12}V8L-7 2V27Z" fill="var(--city-wall)" stroke="#69695b" stroke-width="2"/>
 <path d="M18 27V-${Math.round(h*.6)}L29-${Math.round(h*.6)+7}L35-${Math.round(h*.6)-6}L47-${Math.round(h*.6)+2}V20Z" fill="var(--city-side)" stroke="#5e6258" stroke-width="2"/>
 <path d="M-${w-6} 8H-${w-16}V22H-${w-6}ZM25 3H34V17H25Z" fill="#38413e"/>
 ${tall?'<path d="M-30-43H-21V-31H-30ZM-29-20H-20V-8H-29ZM-31-1H-18M-31-26H-13" fill="#46504a" stroke="#8b8976" stroke-width="2"/>':''}
 <path d="M-6 20V-${h-12}M-3 15V-${h-17}M11 18V-7M14 14V-3" stroke="#535b54" stroke-width="2" fill="none"/>
 <path d="M-24 27L-9 10L14 19L8 30ZM12 28L30 14L48 24L35 33Z" fill="var(--city-roof)" stroke="#535d55" stroke-width="2"/>
 <path d="M-44 29l9-5 8 8ZM-18 31l8-6 8 8ZM0 8l7-4 5 7ZM43 30l9-4 6 7ZM-32 14l6-4 6 5Z" fill="#b9ad91" stroke="#827d6a" stroke-width="1.3"/>
 <path d="M-39-8l7 5-4 10M34-8l-7 5 4 4" fill="none" stroke="#646153" stroke-width="2"/>
 </g>`;
}
