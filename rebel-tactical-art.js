// REBEL-AIRCRAFT-35. Lightweight vector airframes, nose toward -Y.
// Silhouettes are map illustrations; dimensions/weapon payloads remain game values.
let serial=0;
const p=(d,fill,stroke='#34434b',w=.7)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/>`;
const mirror=s=>s+`<g transform="scale(-1 1)">${s}</g>`;
export function tacticalAircraftArt(type){
 const id='air35-'+(++serial),metal=`url(#${id}-metal)`,wing=`url(#${id}-wing)`,glass=`url(#${id}-glass)`;
 const colors=type==='MIG29'?['#bdc8be','#819990','#485e5c']:type==='A10'?['#a6afa0','#748477','#404e49']:['#d0d8dc','#8b9da8','#4c626f'];
 let art=`<defs><linearGradient id="${id}-metal"><stop stop-color="${colors[2]}"/><stop offset=".28" stop-color="${colors[1]}"/><stop offset=".48" stop-color="${colors[0]}"/><stop offset=".68" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[2]}"/></linearGradient><linearGradient id="${id}-wing" x2="0" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient><linearGradient id="${id}-glass" x2=".8" y2="1"><stop stop-color="#b4d7d7"/><stop offset=".3" stop-color="#587f91"/><stop offset=".65" stop-color="#172e40"/><stop offset="1" stop-color="#2f5367"/></linearGradient></defs><g class="air35-surface" stroke-linecap="round">`;
 const line=d=>p(d,'none','#405764',.55),shine=d=>p(d,'none','#e0e6de',.6);
 const nozzle=(x,y,w=4)=>`<g transform="translate(${x} ${y})">${p(`M${-w}-7H${w}L${w*.8} 3H${-w*.8}Z`,'#66777c')}${p(`M${-w*.8} 0H${w*.8}V4H${-w*.8}Z`,'#172c35')}${line('M-2-6V0M0-6V0M2-6V0')}</g>`;
 const store=(x,y)=>`<g transform="translate(${x} ${y})">${p('M0-9L1.4-5V6L3 9H-3L-1.4 6V-5Z','#c3cbc6','#3e535c',.45)}${p('M-1-3H1V-1H-1Z','#9c8b57','none')}</g>`;
 if(type==='F16'){
  art+=p('M-6-24L-12-9L-39 13V21L-11 15L-7 25H7L11 15L39 21V13L12-9L6-24Z',wing);
  art+=mirror(line('M-12-7L-33 13L-35 18L-12 12M-27 15L-25 20'));
  art+=p('M-6 27L-23 42L-22 49L-5 41H5L22 49L23 42L6 27Z',wing);
  art+=nozzle(0,48,5);
  art+=p('M0-64Q3-61 4-49L5-33L7-17L9 2L7 35L5 46H-5L-7 35L-9 2L-7-17L-5-33L-4-49Q-3-61 0-64Z',metal);
  art+=p('M0-64L3-51H-3Z','#586e7b');
  art+=p('M-5-12L-7-4L-6 6H6L7-4L5-12Z','#4f6671');
  art+=p('M0-43Q5-39 4-30L2-23H-2L-4-30Q-5-39 0-43Z',glass,'#233c48',.85);
  art+=shine('M-1-40Q-3-35-2-29');
  art+=p('M0 12L-2 34L0 45L3 37L2 20Z','#5f7584');
  art+=line('M-5-18H5M-5 10H5M-5 31H-2M3 31H5');
  art+=mirror(store(-24,13)+store(-39,14));
 }else if(type==='MIG29'){
  art+=p('M-6-35L-13-22L-19-5L-42 18V25L-15 18L-12 32H12L15 18L42 25V18L19-5L13-22L6-35Z',wing);
  art+=mirror(p('M-9-18L-16-4L-15 36L-10 45L-5 35L-5-11Z',metal));
  art+=p('M-12 26L-26 43V49L-9 43H9L26 49V43L12 26Z',wing);
  art+=nozzle(-10,47,4.7)+nozzle(10,47,4.7);
  art+=p('M0-68L4-55L5-38L8-20L8 17L4 37H-4L-8 17L-8-20L-5-38L-4-55Z',metal);
  art+=p('M0-68L3-55H-3Z','#5a716d');
  art+=p('M0-44Q5-41 4-30L0-23L-4-30Q-5-41 0-44Z',glass);
  art+=mirror(p('M-12 13L-16 29L-13 40L-9 33L-8 19Z','#718980'));
  art+=mirror(p('M-12-13L-15-5L-14 1L-9 0L-8-10Z','#30484b'));
  art+=mirror(line('M-18-2L-36 18L-18 15M-20 19L-21 23M-15 29L-23 43'));
  art+=mirror(store(-27,18)+store(-36,21));art+=shine('M-1-40L-2-32');
 }else if(type==='SU24'){
  art+=p('M-9-19L-21-13L-52 16L-51 27L-16 13L-10 25H10L16 13L51 27L52 16L21-13L9-19Z',wing);
  art+=mirror(p('M-8-20L-13-14V28L-8 43L-3 39V-10Z',metal));
  art+=p('M-8 29L-28 45L-26 52L-8 44H8L26 52L28 45L8 29Z',wing);
  art+=nozzle(-5.8,51,4.8)+nozzle(5.8,51,4.8);
  art+=p('M0-79L4-65L7-51L9-36L11-17L10 22L7 45H-7L-10 22L-11-17L-9-36L-7-51L-4-65Z',metal);
  art+=p('M0-79L4-63L-4-63Z','#536973');
  art+=p('M-6-47L0-52L6-47L7-35H-7Z',glass);
  art+=line('M0-51V-35M-7-35L-6-28H6L7-35');
  art+=mirror(p('M-11-22L-15-15V-2L-11-4Z','#304953'));
  art+=p('M0 12L-2 37L0 48L3 39L2 24Z','#657c8c');
  art+=mirror(line('M-21-10L-45 16L-47 23L-20 12M-10 10H-7M-26 43L-10 39'));
  art+=mirror(store(-24,15)+store(-37,21));
 }else if(type==='A10'){
  art+=p('M-7-11L-56-9L-60-3V9L-8 13H8L60 9V-3L56-9L7-11Z',wing);
  art+=p('M-5 35L-28 36V45L-4 46H4L28 45V36L5 35Z',wing);
  art+=p('M0-50Q7-47 8-35L9-12L6 20L4 48H-4L-6 20L-9-12L-8-35Q-7-47 0-50Z',metal);
  art+=mirror(p('M-18 5Q-25 5-25 12V29Q-24 35-18 35Q-12 35-11 29V12Q-11 5-18 5Z',metal));
  art+=mirror(`<ellipse cx="-18" cy="8" rx="5.8" ry="3" fill="#22383f" stroke="#afbeb6" stroke-width="1"/>${line('M-22 12V28M-14 12V28')}`);
  art+=mirror(p('M-26 31L-29 36V50L-24 48L-23 35Z','#62776d'));
  art+=p('M0-43Q5-41 5-33L3-23H-3L-5-33Q-5-41 0-43Z',glass);
  art+=p('M-3-49V-55H-1V-49Z','#243b43');
  art+=mirror(line('M-53-5H-14M-50 4H-13M-47 5V9M-32 6V11'));
  art+=mirror(store(-19,1)+store(-33,2)+store(-46,3));
 }else if(type==='KC46'){
  art+=p('M-8-32L-21-20L-84 22L-85 31L-19 13L-10 17H10L19 13L85 31L84 22L21-20L8-32Z',wing);
  art+=p('M-7 50L-35 72V78L-6 68H6L35 78V72L7 50Z',wing);
  art+=mirror(p('M-33-7Q-40-10-44-3L-44 16Q-42 21-36 21L-30 16L-29-2Z',metal));
  art+=mirror(`<ellipse cx="-36.5" cy="-4" rx="6" ry="3" fill="#203842" stroke="#d2dbdc" stroke-width="1"/>${line('M-41 2V14M-32 2V14')}`);
  art+=p('M0-96Q9-94 10-79L11-63V46L7 68L3 83H-3L-7 68L-11 46V-63L-10-79Q-9-94 0-96Z',metal);
  art+=p('M-7-83L-3-87H3L7-83L6-79H-6Z',glass);
  art+=line('M-2-86V-80M2-86V-80M-8-66H8M-8 38H8');
  art+=p('M0 38L-2 65L0 81L3 69L2 48Z','#6a808e');
  art+=p('M0 71V94M-6 88L0 94L6 88','none','#81969d',2);
  art+=mirror(line('M-20-13L-76 23L-23 11M-53 17L-55 23M-33 22L-24 20M-30 71L-8 63'));
  art+=mirror(p('M-9-58H-6V-48H-9ZM-9 19H-6V29H-9Z','none','#637b87',.6));
 }else return tacticalAircraftArt('F16');
 // Muted panel highlights; no glow/filter/animation per airframe.
 art+=mirror(shine(type==='KC46'?'M-8-72V34':type==='A10'?'M-7-18L-5 19':'M-4-19L-4 7'));
 art+=`</g>`;return art;
}
