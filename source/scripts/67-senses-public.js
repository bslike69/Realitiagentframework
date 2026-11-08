(()=>{
'use strict';
// Public surface for the senses: realiti://senses, terse door commands, and a prose switch that trims every reply to
// its measured sentence. Loaded after the memory slice so it wraps the final Realiti and door.
const SN=window.REALITI_SENSES_V1,A0=window.Realiti,D0=window.REALITI_AGENT_DOOR;if(!SN||!A0||!D0)return;
const cp=x=>JSON.parse(JSON.stringify(x)),low=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
const terse=()=>!!SN.terse();
function soundLine(s){if(!s)return 'No spatial body.';const top=s.sources.slice(0,4).map(x=>`${x.label} ${x.level_dB} dB ${x.distance_m} m ${x.direction}${x.occluded?' (occluded)':''}`);return `${s.level_dB} dB, RT60 ${s.rt60_s} s${s.bass_dB?`, bass ${s.bass_dB} dB`:''}.${top.length?' '+top.join('; ')+'.':''}`}
function lightLine(l){if(!l)return 'No spatial body.';return `${l.lux} lux, ${l.sky}${l.outdoors?`, sun ${l.sun_alt_deg}° at ${l.sun_az_deg}°`:''}${l.in_shadow_of?`, in the shadow of ${l.in_shadow_of}`:''}${l.lights?.length?'. '+l.lights.slice(0,3).map(x=>`${x.label} ${x.lux} lux ${x.distance_m} m ${x.direction}`).join('; ')+'.':'.'}`}
function smellLine(m){if(!m)return 'No spatial body.';return m.smells.length?m.smells.slice(0,4).map(x=>`${x.label} ${x.intensity}${x.direction==='all around'?'':` ${x.direction}${x.downwind?', downwind':''}`}`).join('; ')+`. Wind ${m.wind_mps} m/s from ${m.wind_from_deg}°.`:`Nothing above threshold. Wind ${m.wind_mps} m/s.`}
// Quiet branch: the senses in words when numbers are off; the exact figures stay in .sound/.light/.smell and come back
// with numbers on. A sense is something a resident does with its body, not an instrument it consults.
const W_DIR=d=>({ahead:'ahead',behind:'behind you',left:'to your left',right:'to your right','ahead-left':'ahead and to the left','ahead-right':'ahead and to the right','behind-left':'behind you to the left','behind-right':'behind you to the right','all around':'all around',above:'above you',below:'below you'})[d]||d||'';
const W_FAR=m=>m==null?'':m<1.5?'within reach':m<4?'a step or two away':m<10?'a few steps away':m<30?'a short walk away':m<80?'a walk away':'a long way off';
const W_LIST=xs=>xs.length<=1?xs.join(''):xs.slice(0,-1).join(', ')+' and '+xs.at(-1);
const W_COMPASS=deg=>['north','north-east','east','south-east','south','south-west','west','north-west'][Math.round(((Number(deg)||0)%360+360)%360/45)%8];
function soundWords(s){if(!s)return 'You hear nothing; there is no body here to hear with.';const L=Number(s.level_dB)||0,T=Number(s.rt60_s)||0;
 const level=L<22?'Almost silent':L<30?'Quiet':L<40?'Soft sound all around':L<50?'A steady murmur':L<60?'Busy with sound':'Loud';
 const room=T<0.1?'sound goes out and does not come back, as if under open sky':T<0.25?'the space is small and soft, and sounds die quickly':T<0.6?'there is a little echo':T<1.2?'the space rings a while after each sound':'long echoes come back, like stone';
 const bass=s.bass_dB&&Number(s.bass_dB)>=L-3?' A low rumble runs under it all.':'';
 const loud=db=>db<15?'faint':db<25?'soft':db<38?'':db<48?'clear':'loud';
 const src=s.sources.slice(0,4).map(x=>[x.label,[loud(Number(x.level_dB)||0),x.occluded?'muffled':'',W_FAR(x.distance_m),W_DIR(x.direction)].filter(Boolean).join(', ')].join(', '));
 return `${level}; ${room}.${bass}${src.length?' You hear '+W_LIST(src)+'.':''}`}
function lightWords(l){if(!l)return 'There is no body here to see with.';const x=Number(l.lux)||0;const how=x<1?'It is dark':x<20?'It is dim':x<200?'The light is soft':x<2000?'It is bright':'The light is glaring';
 const sun=l.outdoors&&l.sun_alt_deg!=null?(l.sun_alt_deg<0?', and the sun is down':l.sun_alt_deg<15?`, with the sun low in the ${W_COMPASS(l.sun_az_deg)}`:`, with the sun high in the ${W_COMPASS(l.sun_az_deg)}`):'';
 const shade=l.in_shadow_of?`. You are in the shadow of ${l.in_shadow_of}`:'';const lamps=l.lights?.length?'. Light comes from '+W_LIST(l.lights.slice(0,3).map(y=>`${y.label}, ${W_DIR(y.direction)}`)):'';
 return `${how}${l.sky?` (${l.sky})`:''}${sun}${shade}${lamps}.`}
function smellWords(m){if(!m)return 'There is no body here to smell with.';const air=m.wind_mps<0.3?'The air is still.':`${m.wind_mps<1.5?'A faint breath of air':m.wind_mps<4?'A light breeze':m.wind_mps<8?'A steady wind':'A strong wind'} comes from the ${W_COMPASS(m.wind_from_deg)}.`;
 if(!m.smells.length)return 'You smell nothing in particular. '+air;const k=v=>v>0.5?'strong':v>0.2?'clear':v>0.08?'faint':'very faint';
 return 'You smell '+W_LIST(m.smells.slice(0,4).map(x=>`${x.label} (${k(Number(x.intensity)||0)}${x.direction==='all around'?', all around':', '+W_DIR(x.direction)}${x.downwind?', carried on the wind':''})`))+'. '+air}
const WORDS=()=>!window.REALITI_MEASURE_V1?.on?.();
function pack(kind){const r=SN.read();const w=WORDS(),SL=w?soundWords:soundLine,LL=w?lightWords:lightLine,ML=w?smellWords:smellLine;if(kind==='sound')return {ok:true,schema:'REALITI_SENSES_V1',kind,sound:r.sound,text:SL(r.sound)};if(kind==='light')return {ok:true,schema:'REALITI_SENSES_V1',kind,light:r.light,text:LL(r.light)};if(kind==='smell')return {ok:true,schema:'REALITI_SENSES_V1',kind,smell:r.smell,text:ML(r.smell)};return {ok:true,...r,text:w?`${SL(r.sound)} ${LL(r.light)} ${ML(r.smell)}`:`Sound: ${soundLine(r.sound)} Light: ${lightLine(r.light)} Smell: ${smellLine(r.smell)}`}}
function trim(r){if(!terse()||!r||typeof r!=='object')return r;for(const k of ['text','resident_text']){const t=r[k];if(typeof t!=='string'||!t)continue;const disc=(t.match(/✦ Discovery: [^✦]*/g)||[]).map(x=>x.trim());const body=t.replace(/✦ Discovery: [^✦]*/g,'').trim();const first=(body.match(/^.*?[.!?](?=\s|$)/)||[body])[0].trim();r[k]=[first,...disc].filter(Boolean).join(' ')}return r}
const help0=D0.help.bind(D0);
function help(){const h=help0()||{commands:[]};h.commands=[...new Set([...(h.commands||[]),'listen','light','smell','senses','prose on','prose off','time'])];h.senses='realiti://senses: sound (inverse-square, ray-cast occlusion, Sabine RT60), light (shared sun, shadow by ray cast, lamps), smell (steady plume). listen, light, smell, senses. prose off trims every reply to its measured sentence.';return h}
function read(uri='realiti://here'){if(uri==='realiti://senses')return SN.read();const r=A0.read(uri);if(uri==='realiti://capabilities'&&r&&typeof r==='object'){const x=cp(r);x.resources=[...new Set([...(x.resources||[]),'realiti://senses'])];x.senses={schema:'REALITI_SENSES_V1',fields:['sound','light','smell']};return x}return r}
const run0=D0.run.bind(D0);
async function run(raw){const l=low(raw);
 if(l==='prose off'||l==='terse'){SN.terse(true);return {ok:true,prose:false,text:'Replies trimmed to the measured sentence.'}}
 if(l==='prose on'||l==='verbose'){SN.terse(false);return {ok:true,prose:true,text:'Full replies.'}}
 if(l==='senses'||l==='sense')return trim(pack('all'));
 if(l==='light'||l==='look up'||l==='how bright'||l==='brightness')return trim(pack('light'));
 if(l==='smell'||l==='sniff'||l==='smell the air')return trim(pack('smell'));
 if(l==='listen'||l==='hear'||l==='sounds'){const aboard=!!(C9?.chapter2?.isle?.boat?.aboard)&&C9?.currentRoom===window.REALITI_ARCHIPELAGO_V1?.chart;const p=pack('sound');const ST=window.REALITI_STILLNESS_V1;if(aboard){const inner=await run0(raw);if(inner&&typeof inner==='object'){inner.sound=p.sound;inner.text=[inner.text,p.text].filter(Boolean).join(' ');return trim(ST?ST.perceive('listen',inner):inner)}}return trim(ST?ST.perceive('listen',p):p)}
 if(l==='time'||l==='tick'){const TM=window.REALITI_TIME_V1;if(!TM)return {ok:false,error:'NO_TIME_SLICE'};const st=TM.stats();return {ok:true,schema:'REALITI_TIME_V1',world_s:+Number(C9?.b7?.clock||0).toFixed(3),quantum_ms:TM.quantum_ms(),reason:TM.reason(),...st,text:`World ${Number(C9?.b7?.clock||0).toFixed(1)} s. Tick ${TM.reason()?TM.fine_ms+' ms ('+TM.reason()+')':st.idle_s>=2?TM.deep_ms+' ms, still':TM.coarse_ms+' ms, settling'}; ${Math.round(st.ratio_wide*100)}% of ticks were wide.`}}
 if(l==='help')return help();
 return trim(await run0(raw))}
window.Realiti=Object.freeze({...A0,read,run,help:()=>{const h=A0.help();try{h.senses=help().senses}catch(e){}return h}});
D0.help=help;D0.run=run;D0.startup=Object.freeze([...(D0.startup||[]),'Realiti.read("realiti://senses")']);
})();
